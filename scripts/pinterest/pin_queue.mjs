#!/usr/bin/env node
// Pinterest daily drip: keep data/pinterest/queue.json stocked and dated.
//
//   node scripts/pinterest/pin_queue.mjs                 weekly run: join new pages, refill if low, date
//   node scripts/pinterest/pin_queue.mjs --seed 7        add 7 variants for every queued page now
//   options: --today YYYY-MM-DD (default: today in America/Chicago)
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
import { addDays, chicagoDate, needsRefill, planRefill, scheduleVariants, unreleasedCount } from '../../lib/pinqueue.mjs';
import { anglesFor, artFor, eligiblePaths, HOST, pageSource } from './pin_sources.mjs';
import { H, renderPin, W } from './render_pin.mjs';

const ROOT = process.cwd();
const QUEUE = path.join(ROOT, 'data/pinterest/queue.json');
const IMAGE_DIR = 'pinterest/drip';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const today = opt('--today') ?? chicagoDate();
if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error(`--today must be YYYY-MM-DD, got ${today}`);
const seed = opt('--seed') ? Number(opt('--seed')) : 0;

const queue = JSON.parse(fs.readFileSync(QUEUE, 'utf8'));
const log = [];

// 1. New product/guide pages join.
for (const pagePath of eligiblePaths()) {
  if (queue.known_pages.includes(pagePath)) continue;
  queue.known_pages.push(pagePath);
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

// 2. Refill.
const pages = queue.pages.filter((p) => owned.has(p.path)).map((p) => ({ ...p, angles: anglesFor(p.path) }));
const due = seed > 0 || needsRefill(queue, today) || pages.some((p) => !queue.variants.some((v) => v.path === p.path));
const count = seed > 0 ? seed * pages.length : queue.config.refill_batch;
const planned = due ? planRefill(queue, pages, count) : [];
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

// 3. Dates.
const firstDay = [queue.config.drip_start, addDays(today, 1)].sort().pop();
scheduleVariants(queue.variants, { pinsPerDay: queue.config.pins_per_day, firstDay });
queue.variants.sort((a, b) => a.seq - b.seq);

fs.writeFileSync(QUEUE, `${JSON.stringify(queue, null, 2)}\n`);
const undated = queue.variants.filter((v) => !v.release_date).length;
const last = queue.variants.reduce((max, v) => (v.release_date && v.release_date > max ? v.release_date : max), '');
for (const line of log) console.log(line);
console.log(`pinterest queue: ${due ? `refilled +${planned.length}` : 'no refill due'}, ${rendered} image(s) rendered, ${unreleasedCount(queue.variants, today)} unreleased after ${today} (threshold ${queue.config.refill_threshold}), dated through ${last || 'none'}, ${undated} undated, ${queue.variants.length} total`);
