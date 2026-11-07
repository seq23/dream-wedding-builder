#!/usr/bin/env node
import pageRescue from '../../data/seo/page_rescue.json' with { type: 'json' };
// Pinterest daily drip: keep data/pinterest/queue.json stocked and dated.
//
//   node scripts/pinterest/pin_queue.mjs                 weekly run: join new pages, refill if low, date
//   node scripts/pinterest/pin_queue.mjs --seed 7        add 7 variants for every queued page now
//   options: --today YYYY-MM-DD (default: today in America/Chicago)
//            --start-today   re-date every unreleased pin at the current pace and give
//                            each topic board one pin today (used once, 1 Nov 2026)
//            --requeue       replace every unreleased pin with a new one (topic art + the
//                            gate; used 6 Nov 2026). Released pins are never touched.
//            --rework f.json redraw the named unreleased pins in the current generation
//                            (config.generation) with the copy in f.json
//                            ({ id: [headline, subline, title, description?] }): new topic
//                            photo, band layout, gate. They wait in queue.pending for her yes.
//            --approve gen   her yes to a sample: generation `gen` may post. Its pins move
//                            from queue.pending into the schedule (re-packed from tomorrow,
//                            spread rule kept, gated again). Run through the workflow:
//                            gh workflow run pinterest-drip.yml -f approve=<gen>
//            --redraw a,b    redraw the unreleased pins of topics a,b with their topic's
//                            current images (after new art lands in topic_art.json): the
//                            first pin due gets the topic's first (lead) image. Copy and
//                            dates stay; released pins are never touched.
//
// Runs DAILY (.github/workflows/pinterest-drip.yml, after the search loop):
// 0. Questions: every live search-loop page (/questions/*) not yet pinned gets its
//    own 1000x1500 image and joins queue.json `questions`, released the same day.
// 0b. Pace: lib/pinqueue.mjs decidePace() over reports/pinterest/metrics_history.json
//    applies the brain's stop rule: 0 visits at 4 weeks -> new format; 8 -> pause.
//
// 1. Pages: any /products/* or /guides/* page this host serves that is not yet in
//    known_pages joins the queue (with art for its product) and is recorded.
// 2. Refill: when fewer than config.refill_threshold variants are unreleased, plan
//    config.refill_batch more (lib/pinqueue.mjs planRefill: fewest-variants page
//    first, next unused angle, next layout/palette) and render their images.
// 3. Dates: every undated variant gets one (config.pins_per_day a day from
//    tomorrow, never the same page two days running).
// Copy is template-only ($0, no model call); see scripts/pinterest/pin_sources.mjs.
// Sample approval (her call 6 Nov 2026): a pin of a generation she has not approved
// (config.generation not in config.approved_generations) is drawn and gated but held in
// queue.pending, which the feed never reads; --approve releases it. The dw-v2 pins she
// approved keep posting as drawn (config.frozen_generations).
// Exits non-zero, naming PINTEREST_QUEUE_EXHAUSTED, when a refill is due and no
// truthful angle is left to use: a refill that adds nothing is not a pass.
import fs from 'node:fs';
import path from 'node:path';
import { addDays, applyFallback, applyPause, chicagoDate, decidePace, needsRefill, pageSlug, planRefill, scheduleVariants, unreleasedCount } from '../../lib/pinqueue.mjs';
import { pinBoards } from '../../lib/pinboards.mjs';
import { searchLoopPages } from '../../lib/search-loop-pages.mjs';
import { anglesFor, artFor, eligiblePaths, HOST, pageSource, questionPin, topicFor, topicImages } from './pin_sources.mjs';
import { gateAndReschedule, gateNewPin, gateQueue } from './quality.mjs';
import { closeRenderer, renderToFile } from './render_pin.mjs';

const ROOT = process.cwd();
const QUEUE = path.join(ROOT, 'data/pinterest/queue.json');
const IMAGE_DIR = 'pinterest/drip';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const today = opt('--today') ?? chicagoDate();
if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error(`--today must be YYYY-MM-DD, got ${today}`);
const seed = opt('--seed') ? Number(opt('--seed')) : 0;
const startToday = args.includes('--start-today');
const requeue = args.includes('--requeue');
const redraw = new Set((opt('--redraw') ?? '').split(',').filter(Boolean));
const approve = opt('--approve');
const reworkFile = opt('--rework');
const handWritten = (pagePath) => readJson('data/pinterest/angles.json')[pagePath] ?? [];
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const queue = JSON.parse(fs.readFileSync(QUEUE, 'utf8'));
const boards = pinBoards(readJson('data/pinterest/boards.json'));
const log = [];
let redate = startToday;
queue.pending ??= [];
queue.questions ??= [];
const approvedGens = new Set(queue.config.approved_generations ?? []);
const awaitsYes = (v) => Boolean(v.generation) && !approvedGens.has(v.generation);
const isQuestionPin = (v) => v.id.startsWith('q-');

// --approve: her yes to a sample. The generation may post; its pins leave queue.pending.
if (approve) {
  const back = queue.pending.filter((v) => v.generation === approve);
  if (!back.length && !approvedGens.has(approve)) throw new Error(`--approve ${approve}: no pending pins of that generation (pending: ${[...new Set(queue.pending.map((v) => v.generation))].join(', ') || 'none'})`);
  approvedGens.add(approve);
  queue.config.approved_generations = [...approvedGens];
  queue.pending = queue.pending.filter((v) => v.generation !== approve);
  for (const v of back) {
    if (isQuestionPin(v)) queue.questions.push({ ...v, release_date: today });
    else queue.variants.push({ ...v, release_date: null });
  }
  queue.config.pace.log = [...(queue.config.pace.log ?? []), { at: today, change: `approved ${approve}: ${back.length} pending pin(s) join the schedule`, why: 'her yes to the sample page' }];
  redate = true;
  log.push(`APPROVED ${approve}: ${back.length} pin(s) released from pending into the schedule`);
}

// 0b. Pace: the measured fallback, decided from the weekly visit counts.
const historyFile = path.join(ROOT, 'reports/pinterest/metrics_history.json');
const pace = decidePace(queue.config, fs.existsSync(historyFile) ? JSON.parse(fs.readFileSync(historyFile, 'utf8')) : [], today);
if (pace.action === 'fallback') {
  applyFallback(queue.config, today, pace.reason);
  redate = true;
  log.push(`PACE FALLBACK: ${pace.reason} -> ${queue.config.pins_per_day} pins a day, layouts ${queue.config.layouts.join('/')}`);
} else if (pace.action === 'pause') {
  applyPause(queue.config, queue.variants, today, pace.reason);
  console.log(`NAMED STOP: PINTEREST_PAUSED - ${pace.reason}; no new pins are dated, published pins stay (Growth playbook: 8 weeks at 0 -> pause, never delete).`);
  if (process.env.GITHUB_ACTIONS) console.log(`::warning title=PINTEREST_PAUSED::${pace.reason}`);
} else log.push(`pace: keep ${queue.config.pins_per_day} a day (${pace.reason})`);
if (redate) for (const v of queue.variants) if (v.release_date && v.release_date > today) v.release_date = null;

// 1. New product/guide pages join. A page recorded in known_pages but never queued
// (the 16 Oct seed recorded 30 and queued 6) joins too.
for (const pagePath of eligiblePaths()) {
  if (queue.pages.some((p) => p.path === pagePath)) continue;
  if (!queue.known_pages.includes(pagePath)) queue.known_pages.push(pagePath);
  const source = pageSource(pagePath);
  if (!source) { log.push(`SKIPPED ${pagePath}: no source record to write truthful copy from`); continue; }
  queue.pages.push({ path: pagePath, art: [], joined: today });
  log.push(`JOINED ${pagePath}`);
}
queue.known_pages.sort();
// Every page draws from its topic art (data/pinterest/topic_art.json); a page with no topic
// keeps the product art, and the quality gate holds its pins (NO_TOPIC_ART) until one is added.
for (const page of queue.pages) {
  const topic = topicFor(page.path);
  page.art = topic ? topicImages(topic) : artFor(pageSource(page.path)?.productId ?? 'checklist-pdf').slice(0, 4);
  if (topic) page.topic = topic; else delete page.topic;
}

// --redraw: unreleased pins of the named topics take their topic's images in release order
// (lead image first) and lose their drawn image, so the render + gate below redraw them.
if (redraw.size) {
  for (const t of redraw) if (!topicImages(t).length) throw new Error(`--redraw ${t}: no images for that topic in data/pinterest/topic_art.json`);
  const waiting = queue.variants.filter((v) => redraw.has(v.topic) && (!v.release_date || v.release_date > today)).sort((a, b) => (a.release_date ?? '9999') < (b.release_date ?? '9999') ? -1 : (a.release_date ?? '9999') > (b.release_date ?? '9999') ? 1 : a.seq - b.seq);
  const next = new Map();
  for (const v of waiting) {
    const images = topicImages(v.topic);
    const i = next.get(v.topic) ?? 0;
    v.art = images[i % images.length];
    next.set(v.topic, i + 1);
    if (v.image?.path && fs.existsSync(path.join(ROOT, 'public', v.image.path))) fs.unlinkSync(path.join(ROOT, 'public', v.image.path));
    delete v.image;
  }
  log.push(`REDRAW: ${waiting.length} unreleased pin(s) of ${[...redraw].join(', ')}; published pins kept`);
}

// --rework: the named unreleased pins take new copy and the current generation; each page's
// reworked pins rotate through its topic's photos and the band layouts and palettes, and lose
// their drawn image so the render + gate below redraw them.
if (reworkFile) {
  const copy = JSON.parse(fs.readFileSync(reworkFile, 'utf8'));
  const { layouts, palettes, generation } = queue.config;
  if (!generation) throw new Error('--rework: config.generation is not set');
  const perPage = new Map();
  const targets = Object.keys(copy).map((id) => {
    const v = queue.variants.find((x) => x.id === id);
    if (!v) throw new Error(`--rework: no pin ${id}`);
    if (v.release_date && v.release_date <= today) throw new Error(`--rework: ${id} is released; published pins are never touched`);
    return v;
  }).sort((a, b) => a.seq - b.seq);
  for (const v of targets) {
    const [headline, subline, title, description] = copy[v.id];
    const k = perPage.get(v.path) ?? 0;
    perPage.set(v.path, k + 1);
    const images = topicImages(topicFor(v.path));
    if (!images.length) throw new Error(`--rework: no topic photos for ${v.path}`);
    Object.assign(v, { headline, subline, title, ...(description ? { description } : {}), generation, layout: layouts[k % layouts.length], palette: palettes[(k + 1) % palettes.length], art: images[(k + v.seq) % images.length], topic: topicFor(v.path), release_date: null });
    if (v.image?.path && fs.existsSync(path.join(ROOT, 'public', v.image.path))) fs.unlinkSync(path.join(ROOT, 'public', v.image.path));
    delete v.image;
  }
  for (const v of queue.variants) if (v.release_date && v.release_date > today) v.release_date = null;
  log.push(`REWORK: ${targets.length} unreleased pin(s) redrawn as ${generation}; published pins kept`);
}

// --requeue: every pin not yet released is retired (its id is never reused) and its image
// deleted; the refill below plans the replacements. Published pins are never touched.
if (requeue) {
  const out = queue.variants.filter((v) => !v.release_date || v.release_date > today);
  queue.retired_ids = [...new Set([...(queue.retired_ids ?? []), ...out.map((v) => v.id)])];
  for (const v of out) if (v.image?.path && fs.existsSync(path.join(ROOT, 'public', v.image.path))) fs.unlinkSync(path.join(ROOT, 'public', v.image.path));
  queue.variants = queue.variants.filter((v) => v.release_date && v.release_date <= today);
  log.push(`REQUEUE: retired ${out.length} unreleased pin(s); published pins kept`);
}

// A page that stopped being served must not be released.
const owned = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/seo/route_ownership.json'), 'utf8')).routes.filter((r) => r.host === HOST).map((r) => r.path));
const before = queue.variants.length;
queue.variants = queue.variants.filter((v) => (v.release_date && v.release_date <= today) || owned.has(v.path));
if (queue.variants.length !== before) log.push(`DROPPED ${before - queue.variants.length} unreleased variant(s) for pages no longer served`);
// A drop leaves holes in the dated schedule (2026-11-04..06 the drip went red with
// "gap in the schedule" after the consolidation retired 17 guides): every pin not yet
// released goes back in the pool so scheduleVariants re-packs it from tomorrow.
if (queue.variants.length !== before) for (const v of queue.variants) if (v.release_date && v.release_date > today) delete v.release_date;

// 2. Refill.
const pages = queue.pages.filter((p) => owned.has(p.path) && !Object.hasOwn(pageRescue.redirects, p.path)).map((p) => ({ ...p, angles: requeue ? handWritten(p.path) : anglesFor(p.path) }));
const paused = pace.action === 'pause';
const joining = pages.filter((p) => !queue.variants.some((v) => v.path === p.path) && !queue.pending.some((v) => v.path === p.path));
const lowStock = needsRefill(queue, today);
const due = !paused && (seed > 0 || requeue || lowStock || joining.length > 0);
// A re-queue plans every unused hand-written angle (the gate drops what cannot be made good).
// A page that joins while stock is full gets its own pins only: one per photo of its topic
// (each pin a different photo), never a full refill batch across every page.
const joinOnly = !seed && !requeue && !lowStock && joining.length > 0;
const count = seed > 0 ? seed * pages.length : requeue ? pages.reduce((n, p) => n + p.angles.length, 0) : joinOnly ? joining.reduce((n, p) => n + Math.min(p.art.length, p.angles.length), 0) : queue.config.refill_batch;
const planJoin = () => {
  const out = [];
  for (const p of joining) out.push(...planRefill({ ...queue, variants: [...queue.variants, ...out] }, [p], Math.min(p.art.length, p.angles.length)));
  return out;
};
const planned = due ? (joinOnly ? planJoin() : planRefill(queue, pages, count)) : [];
// A refill's new pins sit on the few pages with the fewest variants. Appended after the
// pins already dated they cannot fill a day without repeating a page (2026-11-13
// simulation: 14 new pins on 4 pages gave 2-pin days), so every pin not yet released goes
// back in the pool with them and scheduleVariants re-packs the lot from tomorrow.
if (planned.length) for (const v of queue.variants) if (v.release_date && v.release_date > today) delete v.release_date;
if (due && !planned.length) {
  console.error(`NAMED STOP: PINTEREST_QUEUE_EXHAUSTED - ${unreleasedCount(queue.variants, today)} unreleased (threshold ${queue.config.refill_threshold}) and no unused angle left on any page; add angles to data/pinterest/angles.json.`);
  process.exit(1);
}
queue.variants.push(...planned);

// Images for every variant that has none yet.
fs.mkdirSync(path.join(ROOT, 'public', IMAGE_DIR), { recursive: true });
let rendered = 0;
for (const variant of queue.variants) {
  const rel = `/${IMAGE_DIR}/${variant.id}.jpg`;
  if (variant.image && fs.existsSync(path.join(ROOT, 'public', rel))) continue;
  const drawn = await renderToFile(variant, rel);
  variant.image = { ...drawn.image, text: drawn.text, shape: drawn.shape };
  rendered += 1;
}

// 0. Question pages from the search loop: one pin each, released the day it is pinned
// (or, while its generation awaits her yes, held in queue.pending).
const slConfig = readJson('search-loop.config.json');
for (const page of paused ? [] : searchLoopPages(slConfig, readJson('data/search-loop/pages.json'))) {
  const id = `q-${pageSlug(page.route.replace(/^\/questions\//, ''))}`;
  if (queue.questions.some((q) => q.id === id) || queue.pending.some((q) => q.id === id)) continue;
  const pin = questionPin(page, slConfig, id);
  if (!pin) { log.push(`SKIPPED ${page.route}: no page file or question too long to print on a pin`); continue; }
  if (queue.config.generation) pin.generation = queue.config.generation;
  const gated = await gateNewPin(pin, queue, today);
  if (gated.held) { log.push(`PIN_QUALITY_HOLD ${page.route}: ${gated.held}`); continue; }
  if (awaitsYes(gated)) { queue.pending.push({ ...gated, release_date: null }); log.push(`PENDING question pin ${page.route} (awaits approval of ${gated.generation})`); continue; }
  queue.questions.push({ ...gated, release_date: today });
  log.push(`QUESTION PIN ${page.route} -> ${boards.boardFor(page.route, pin.title).slug}`);
}
// A question page the engine merged away must not stay in a feed.
const liveRoutes = new Set(searchLoopPages(slConfig, readJson('data/search-loop/pages.json')).map((p) => p.route));
queue.questions = queue.questions.filter((q) => liveRoutes.has(q.path));

// --start-today: fill today's remaining slots (pins_per_day) with one pin each for the
// topic boards that have the most pins waiting, never a page that ran yesterday, so the
// new board feeds are not empty when they are connected in Pinterest.
if (startToday) {
  const onDay = (d) => queue.variants.filter((v) => v.release_date === d);
  const yesterday = new Set(onDay(addDays(today, -1)).map((v) => v.path));
  const boardsToday = new Set(onDay(today).map((v) => boards.boardFor(v.path).slug));
  const waiting = (slug) => queue.variants.filter((v) => !v.release_date && boards.boardFor(v.path).slug === slug).length;
  for (const board of [...boards.BOARDS].sort((a, b) => waiting(b.slug) - waiting(a.slug))) {
    if (onDay(today).length >= queue.config.pins_per_day) break;
    if (boardsToday.has(board.slug)) continue;
    const pick = queue.variants.filter((v) => !v.release_date && !yesterday.has(v.path) && boards.boardFor(v.path).slug === board.slug).sort((a, b) => a.seq - b.seq)[0];
    if (pick) { pick.release_date = today; boardsToday.add(board.slug); log.push(`TODAY ${board.slug}: ${pick.id}`); }
  }
}

// Pins of a generation she has not approved wait in queue.pending (the feed never reads it);
// the schedule re-packs around them.
const waiting = queue.variants.filter((v) => (!v.release_date || v.release_date > today) && awaitsYes(v));
if (waiting.length) {
  queue.variants = queue.variants.filter((v) => !waiting.includes(v));
  for (const v of waiting) v.release_date = null;
  queue.pending.push(...waiting);
  for (const v of queue.variants) if (v.release_date && v.release_date > today) v.release_date = null;
  log.push(`PENDING: ${waiting.length} pin(s) of ${[...new Set(waiting.map((v) => v.generation))].join(', ')} await her approval (release: gh workflow run pinterest-drip.yml -f approve=<generation>)`);
}

// 3. Dates.
const firstDay = [queue.config.drip_start, addDays(today, 1)].sort().pop();
if (!paused) scheduleVariants(queue.variants, { pinsPerDay: queue.config.pins_per_day, firstDay });

// 4. Quality gate (scripts/pinterest/quality.mjs): every unreleased pin must look new, show
// its page's topic, state the searcher's benefit and read at 236px; one that cannot be made
// good is held and never posted.
const gate = paused ? { reworked: [], held: [] } : await gateAndReschedule(queue, today);
log.push(`quality gate: ${gate.reworked.length} reworked, ${gate.held.length} held`);
// Pending pins pass the same gate now, so the sample she approves is what posts.
if (!paused && queue.pending.some((v) => !isQuestionPin(v))) {
  const draft = { ...queue, variants: [...queue.variants, ...queue.pending.filter((v) => !isQuestionPin(v))] };
  const r = await gateQueue(draft, today);
  const keep = new Set(draft.variants.map((v) => v.id));
  queue.pending = queue.pending.filter((v) => isQuestionPin(v) || keep.has(v.id));
  queue.held = draft.held;
  for (const h of r.held) console.log(`PIN_QUALITY_HOLD (pending) ${h.id}: ${h.reason}`);
  log.push(`pending gate: ${r.reworked.length} reworked, ${r.held.length} held, ${queue.pending.length} awaiting approval`);
}
closeRenderer();
queue.variants.sort((a, b) => a.seq - b.seq);

fs.writeFileSync(QUEUE, `${JSON.stringify(queue, null, 2)}\n`);
const undated = queue.variants.filter((v) => !v.release_date).length;
const perBoard = Object.fromEntries(boards.BOARDS.map((b) => [b.slug, queue.variants.filter((v) => v.release_date > today && boards.boardFor(v.path).slug === b.slug).length]));
log.push(`unreleased per board: ${JSON.stringify(perBoard)}; ${queue.questions.length} question pin(s)`);
const last = queue.variants.reduce((max, v) => (v.release_date && v.release_date > max ? v.release_date : max), '');
for (const line of log) console.log(line);
console.log(`pinterest queue: ${due ? `refilled +${planned.length}` : 'no refill due'}, ${rendered} image(s) rendered, ${unreleasedCount(queue.variants, today)} unreleased after ${today} (threshold ${queue.config.refill_threshold}), dated through ${last || 'none'}, ${undated} undated, ${queue.pending.length} awaiting approval, ${queue.variants.length} total`);
