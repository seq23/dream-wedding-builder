#!/usr/bin/env node
import pageRescue from '../../data/seo/page_rescue.json' with { type: 'json' };
// Pinterest daily drip: keep data/pinterest/queue.json stocked and dated.
//
//   node scripts/pinterest/pin_queue.mjs                 weekly run: join new pages, refill if low, date
//   node scripts/pinterest/pin_queue.mjs --seed 7        add 7 variants for every queued page now
//   options: --today YYYY-MM-DD (default: today in America/Chicago)
//            --start-today   re-date every unreleased pin at the current pace and give
//                            each topic board one pin today (used once, 1 Nov 2026)
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
// Exits non-zero, naming PINTEREST_QUEUE_EXHAUSTED, when a refill is due and no
// truthful angle is left to use: a refill that adds nothing is not a pass.
import fs from 'node:fs';
import path from 'node:path';
import { addDays, applyFallback, applyPause, chicagoDate, decidePace, needsRefill, pageSlug, planRefill, scheduleVariants, unreleasedCount } from '../../lib/pinqueue.mjs';
import { pinBoards } from '../../lib/pinboards.mjs';
import { searchLoopPages } from '../../lib/search-loop-pages.mjs';
import { anglesFor, artFor, eligiblePaths, HOST, pageSource, questionPin } from './pin_sources.mjs';
import { H, renderPin, W } from './render_pin.mjs';

const ROOT = process.cwd();
const QUEUE = path.join(ROOT, 'data/pinterest/queue.json');
const IMAGE_DIR = 'pinterest/drip';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const today = opt('--today') ?? chicagoDate();
if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error(`--today must be YYYY-MM-DD, got ${today}`);
const seed = opt('--seed') ? Number(opt('--seed')) : 0;
const startToday = args.includes('--start-today');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const queue = JSON.parse(fs.readFileSync(QUEUE, 'utf8'));
const boards = pinBoards(readJson('data/pinterest/boards.json'));
const log = [];
let redate = startToday;

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
  queue.pages.push({ path: pagePath, art: artFor(source.productId).slice(0, 4), joined: today });
  log.push(`JOINED ${pagePath}`);
}
queue.known_pages.sort();

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
const pages = queue.pages.filter((p) => owned.has(p.path) && !Object.hasOwn(pageRescue.redirects, p.path)).map((p) => ({ ...p, angles: anglesFor(p.path) }));
const paused = pace.action === 'pause';
const due = !paused && (seed > 0 || needsRefill(queue, today) || pages.some((p) => !queue.variants.some((v) => v.path === p.path)));
const count = seed > 0 ? seed * pages.length : queue.config.refill_batch;
const planned = due ? planRefill(queue, pages, count) : [];
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
  const buffer = await renderPin(variant);
  fs.writeFileSync(path.join(ROOT, 'public', rel), buffer);
  variant.image = { path: rel, type: 'image/jpeg', width: W, height: H, length: buffer.length };
  rendered += 1;
}

// 0. Question pages from the search loop: one pin each, released the day it is pinned.
queue.questions ??= [];
const slConfig = readJson('search-loop.config.json');
for (const page of paused ? [] : searchLoopPages(slConfig, readJson('data/search-loop/pages.json'))) {
  const id = `q-${pageSlug(page.route.replace(/^\/questions\//, ''))}`;
  if (queue.questions.some((q) => q.id === id)) continue;
  const pin = questionPin(page, slConfig, id);
  if (!pin) { log.push(`SKIPPED ${page.route}: no page file or question too long to print on a pin`); continue; }
  const rel = `/${IMAGE_DIR}/${id}.jpg`;
  const buffer = await renderPin(pin);
  fs.writeFileSync(path.join(ROOT, 'public', rel), buffer);
  queue.questions.push({ ...pin, release_date: today, image: { path: rel, type: 'image/jpeg', width: W, height: H, length: buffer.length } });
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

// 3. Dates.
const firstDay = [queue.config.drip_start, addDays(today, 1)].sort().pop();
if (!paused) scheduleVariants(queue.variants, { pinsPerDay: queue.config.pins_per_day, firstDay });
queue.variants.sort((a, b) => a.seq - b.seq);

fs.writeFileSync(QUEUE, `${JSON.stringify(queue, null, 2)}\n`);
const undated = queue.variants.filter((v) => !v.release_date).length;
const perBoard = Object.fromEntries(boards.BOARDS.map((b) => [b.slug, queue.variants.filter((v) => v.release_date > today && boards.boardFor(v.path).slug === b.slug).length]));
log.push(`unreleased per board: ${JSON.stringify(perBoard)}; ${queue.questions.length} question pin(s)`);
const last = queue.variants.reduce((max, v) => (v.release_date && v.release_date > max ? v.release_date : max), '');
for (const line of log) console.log(line);
console.log(`pinterest queue: ${due ? `refilled +${planned.length}` : 'no refill due'}, ${rendered} image(s) rendered, ${unreleasedCount(queue.variants, today)} unreleased after ${today} (threshold ${queue.config.refill_threshold}), dated through ${last || 'none'}, ${undated} undated, ${queue.variants.length} total`);
