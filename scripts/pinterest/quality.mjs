// Pin quality gate for the Pinterest daily drip (her call 6 Nov 2026: "approve all, make
// them good"; rules from the 6 Nov Pinterest assessment: pretty, glossy, search-worded and
// never like an ad). A pin may stay scheduled only if:
//   1. LOOK: its image differs from the account's recent pins. A 256-bit difference hash
//      (dHash, 17x16 grayscale) is at least MIN_DISTANCE bits from each of the
//      RECENT_WINDOW pins released just before it (calibration in MIN_DISTANCE below).
//   2. TOPIC + PHOTO: its art is one of its page's topic photos (data/pinterest/
//      topic_art.json) and that photo is a real photo, never a product screenshot, from the
//      free Unsplash licence (never Unsplash+), Pexels or Pixabay, at least 1000px wide,
//      checked free of watermarks, with photographer, page and licence recorded.
//   3. NO SALES WORDS in its headline, subline or title (SALES below): no price, $, paid,
//      buy, deal, sale, suite, bundle, "included in", "look inside", "the real file",
//      "preview", "not editable".
//   4. SEARCH-WORDED: the headline is the search phrase (it carries one of the page's
//      searches, topic_art.json pages.<path>.search), at most MAX_IMAGE_WORDS words; the
//      subline is the instruction, at most MAX_IMAGE_WORDS words, saying at least
//      MIN_BEYOND_LABEL words more than the page's name; the title starts with a search.
//      A numbered headline ("12 ...") needs the page to hold that many items
//      (pages.<path>.items).
//   5. LAYOUT: drawn by the band renderer: the photo fills at least MIN_PHOTO_FRACTION of
//      the pin under ONE soft band, and the brand line is BRAND ("Wedding Checklist PDF").
//   6. THUMBNAIL: every text role was drawn uncut and stays readable on a 236px-wide phone
//      thumbnail: headline >= 14px, subline >= 10px there, contrast >= 4.5:1.
// A failing pin is redrawn with the page's other unused copy, other layouts and palettes
// and its topic's other photos; the first version that passes is kept. If none does it is
// held (removed from the schedule, recorded in queue.held, named in PIN_QUALITY_HOLD) and
// never posted. Released pins are never touched, and pins of a frozen generation
// (config.frozen_generations: the dw-v2 pins she approved as drawn) keep their images.
// The spread rule (at most 2 pins per page in any 7 days, each with another photo) is the
// scheduler's (lib/pinqueue.mjs scheduleVariants); auditQueue checks it too.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { addDays, scheduleVariants, spreadViolations } from '../../lib/pinqueue.mjs';
import { anglesFor, imageRecord, pageItems, pageSource, searchesFor, topicFor, topicImages } from './pin_sources.mjs';
import { BRAND, LAYOUTS, PALETTES, renderToFile } from './render_pin.mjs';

export const THUMB_WIDTH = 236;
// Measured 6 Nov 2026 on the new renderer: the same photo and layout re-coloured is 9 bits
// away (a near-duplicate to Pinterest); another photo in the same layout 67-85; another
// layout 82-130. 40 rejects a re-coloured repeat and keeps everything else.
export const MIN_DISTANCE = 40;
export const RECENT_WINDOW = 12;
export const MIN_HEADLINE_WORDS = 4;
export const MIN_BEYOND_LABEL = 2;
export const MIN_HEADLINE_THUMB_PX = 14;
export const MIN_TEXT_THUMB_PX = 10;
export const MIN_CONTRAST = 4.5;
export const MAX_IMAGE_WORDS = 7;
export const MIN_PHOTO_FRACTION = 0.6;
export const MIN_PHOTO_WIDTH = 1000;
export const PHOTO_SOURCES = { unsplash: 'https://unsplash.com/license', pexels: 'https://www.pexels.com/license/', pixabay: 'https://pixabay.com/service/license-summary/' };
// Sales words that make a pin read as an ad (the 6 Nov assessment's list).
export const SALES = /\$|\b(?:prices?|priced|pricing|paid|buy|buying|deals?|sales?|suites?|bundles?|preview|previews)\b|included in|look inside|the real file|not editable/i;
const MAX_RENDERS_PER_PIN = 40;

const ROOT = process.cwd();
const GENERIC = new Set(['wedding', 'weddings', 'checklist', 'checklists', 'list', 'guide', 'free', 'the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'at', 'by', 'with', 'from', 'your', 'you', 'my', 'our', 'is', 'are', 'it', 'its', 'one', 'all', 'not', 'no', 'how', 'what', 'when', 'who', 'do', 'does', 'can', 'should', 'be', 'that', 'this', 'than', 'before', 'after', 'each', 'every']);
const words = (s) => String(s ?? '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/).filter(Boolean);
// Same word when equal, or when both are 4+ letters and agree on their first five letters,
// or on all of the shorter one's (plan / planning, elope / eloping, seat / seating).
const same = (a, b) => { if (a === b) return true; const k = Math.min(5, a.length, b.length); return k >= 4 && a.slice(0, k) === b.slice(0, k); };

export async function dHash(input) {
  const w = 17, h = 16;
  const { data } = await sharp(input).grayscale().resize(w, h, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const bits = new Uint8Array((w - 1) * h);
  let k = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w - 1; x++) bits[k++] = data[y * w + x] > data[y * w + x + 1] ? 1 : 0;
  return bits;
}
export const distance = (a, b) => a.reduce((s, x, i) => s + (x !== b[i] ? 1 : 0), 0);

const isQuestion = (v) => v.id.startsWith('q-');
const norm = (art) => `/${String(art).replace(/^\/+/, '')}`;

/** The distinctive words of the searches the pin's page answers. */
export function searchTerms(v) {
  const searches = isQuestion(v) ? v.search ?? [v.title] : searchesFor(v.path);
  return [...new Set(searches.flatMap(words).filter((w) => !GENERIC.has(w)))];
}

const phrase = (s) => words(s).join(' ');
const searches = (v) => (isQuestion(v) ? v.search ?? [v.title] : searchesFor(v.path)).map(phrase).filter(Boolean);
/** A pin of a generation she approved as drawn (config.frozen_generations): never redrawn. */
export const isFrozen = (v, config) => Boolean(v.generation && (config?.frozen_generations ?? []).includes(v.generation));

export function salesIssue(v) {
  for (const field of ['headline', 'subline', 'title']) {
    const m = String(v[field] ?? '').match(SALES);
    if (m) return `${field} "${flat(v[field])}" carries the sales word "${m[0]}": pins must not read as ads`;
  }
  return null;
}

/** Headline = the search phrase, subline = the instruction, title starts with a search. */
export function copyIssue(v) {
  const hw = words(v.headline), sw = words(v.subline);
  if (hw.length > MAX_IMAGE_WORDS) return `headline "${flat(v.headline)}" has ${hw.length} words, at most ${MAX_IMAGE_WORDS} read at grid size`;
  if (sw.length > MAX_IMAGE_WORDS) return `subline "${flat(v.subline)}" has ${sw.length} words, at most ${MAX_IMAGE_WORDS} read at grid size`;
  const list = searches(v);
  if (!list.length) return `no searches recorded for ${v.path} (data/pinterest/topic_art.json pages.search)`;
  const head = ` ${phrase(v.headline)} `;
  if (!list.some((s) => head.includes(` ${s} `))) return `headline "${flat(v.headline)}" is not a search phrase of its page (${list.join(' / ')})`;
  const n = Number(phrase(v.headline).match(/^(\d+) /)?.[1] ?? NaN);
  if (Number.isFinite(n) && !(pageItems(v.path) >= n)) return `numbered headline "${flat(v.headline)}": the page holds ${pageItems(v.path) ?? 'no counted'} items, not ${n}`;
  if (!list.some((s) => phrase(v.title).startsWith(s))) return `title "${v.title}" does not start with what people search (${list.join(' / ')})`;
  if (isQuestion(v)) return null;
  const label = new Set([...words(pageSource(v.path)?.name), ...searchTerms(v)]);
  const beyond = sw.filter((w) => !GENERIC.has(w) && ![...label].some((l) => same(w, l)));
  if (beyond.length < MIN_BEYOND_LABEL) return `subline "${flat(v.subline)}" only restates the page's name (${beyond.length} word(s) beyond it, need >= ${MIN_BEYOND_LABEL}): it must say what to do`;
  return null;
}

/** The photo itself: a licensed, watermark-free, wide-enough photo, never a screenshot. */
export function photoIssue(art) {
  const rec = imageRecord(art);
  if (!rec) return `art ${art} has no record in data/pinterest/topic_art.json`;
  if (rec.retired || rec.kind !== 'photo' || /\.png$/i.test(rec.file) || /product-images\//.test(rec.file)) return `art ${art} is a product screenshot or retired image, not a photo`;
  if (!PHOTO_SOURCES[rec.source] || rec.licence !== rec.source || rec.licence_url !== PHOTO_SOURCES[rec.source]) return `art ${art} is from ${rec.source} (${rec.licence}): only the free Unsplash licence, Pexels or Pixabay`;
  if (/plus\.unsplash\.com/.test(String(rec.image_url))) return `art ${art} is an Unsplash+ photo`;
  if (rec.watermark !== false) return `art ${art} is not recorded as checked free of watermarks`;
  if (!(Number(rec.width) >= MIN_PHOTO_WIDTH) || (rec.original_width != null && !(Number(rec.original_width) >= MIN_PHOTO_WIDTH))) return `art ${art} is ${rec.width}px wide, need >= ${MIN_PHOTO_WIDTH}px`;
  if (!rec.creator || !/^https:\/\//.test(String(rec.landing_url))) return `art ${art} has no photographer or page link recorded`;
  return null;
}

export function topicIssue(v) {
  const expected = isQuestion(v) ? v.topic : topicFor(v.path);
  if (!expected) return `NO_TOPIC_ART: no topic art mapped for ${v.path}; add it to data/pinterest/topic_art.json`;
  if (v.topic !== expected) return `topic "${v.topic ?? 'none'}" is not its page's topic "${expected}"`;
  if (!topicImages(expected).includes(norm(v.art))) return `art ${v.art} is not one of the "${expected}" topic images`;
  return photoIssue(norm(v.art));
}

/** The drawn layout (render_pin.py shape metrics, stored on v.image.shape). */
export function layoutIssue(v, shape = v.image?.shape) {
  if (!LAYOUTS.includes(v.layout)) return `layout ${v.layout} is retired (binder-page, tab-panel and the other framed layouts)`;
  if (!shape) return 'no layout metrics from the renderer (image not drawn by the band renderer)';
  if (!(shape.photo_fraction >= MIN_PHOTO_FRACTION)) return `photo fills ${Math.round(shape.photo_fraction * 100)}% of the pin, need >= ${MIN_PHOTO_FRACTION * 100}%`;
  if (shape.bands !== 1) return `${shape.bands} text bands, need exactly one`;
  if (shape.brand !== BRAND) return `brand line "${shape.brand}", need "${BRAND}"`;
  return null;
}

/** Every copy-and-art rule that needs no drawing. */
export const designIssue = (v) => topicIssue(v) || salesIssue(v) || copyIssue(v);

const lum = (hex) => {
  const c = hex.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

/** `text` is the renderer's metrics for the image (render_pin.py), stored on v.image.text. */
export function thumbnailIssue(v, text = v.image?.text) {
  if (!Array.isArray(text) || !text.some((t) => t.role === 'headline')) return 'no text metrics from the renderer (image not drawn by render_pin.py)';
  const scale = THUMB_WIDTH / 1000;
  for (const t of text) {
    if (!t.fit) return `${t.role} "${t.lines.join(' ')}" does not fit its ${v.layout} panel uncut`;
    const px = t.size * scale, floor = t.role === 'headline' ? MIN_HEADLINE_THUMB_PX : MIN_TEXT_THUMB_PX;
    // The brand line is meant to be small (Pinterest: keep the brand quiet); it is checked
    // for contrast only.
    if (t.role !== 'brand' && px < floor) return `${t.role} is ${px.toFixed(1)}px on a ${THUMB_WIDTH}px thumbnail, need >= ${floor}px`;
    const cr = contrast(t.ink, t.ground);
    if (cr < MIN_CONTRAST) return `${t.role} contrast ${cr.toFixed(1)}:1, need >= ${MIN_CONTRAST}:1`;
  }
  return null;
}

const flat = (s) => String(s).replace(/\s*\n\s*/g, ' ');
const releaseKey = (v) => `${v.release_date ?? '9999-99-99'}|${String(v.seq ?? 0).padStart(6, '0')}`;
const byRelease = (a, b) => (releaseKey(a) < releaseKey(b) ? -1 : releaseKey(a) > releaseKey(b) ? 1 : 0);
const fileOf = (v) => (v.image?.path ? path.join(ROOT, 'public', v.image.path) : null);
const copyKey = (v) => `${flat(v.headline)}|${v.subline}`.toLowerCase().replace(/\s+/g, ' ');

async function hashFile(cache, v) {
  const f = fileOf(v);
  if (!f || !fs.existsSync(f)) return null;
  const key = `${f}|${v.image.length}`;
  if (!cache.has(key)) cache.set(key, await dHash(fs.readFileSync(f)));
  return cache.get(key);
}

const nearIssue = (hash, recent) => {
  const near = recent.map((r) => distance(hash, r)).filter((d) => d < MIN_DISTANCE);
  return near.length ? `image only ${Math.min(...near)} bits from a pin released just before it (need >= ${MIN_DISTANCE})` : null;
};

/**
 * Gate every pin released after `today` (mutates queue.variants and the drip images;
 * released pins are never touched). Returns { reworked: [{id, from, to, reason}], held: [{id, reason}] }.
 */
export async function gateQueue(queue, today, { render = renderToFile } = {}) {
  const hashes = new Map();
  const all = [...queue.variants, ...(queue.questions ?? [])].sort(byRelease);
  const kept = [];
  const reworked = [], held = [];
  for (const v of all) {
    // Released pins, and pins she approved as drawn (a frozen generation), are never redrawn.
    if ((v.release_date && v.release_date <= today) || isFrozen(v, queue.config)) { kept.push(v); continue; }
    const recent = (await Promise.all(kept.slice(-RECENT_WINDOW).map((x) => hashFile(hashes, x)))).filter(Boolean);
    const page = queue.variants.filter((x) => x.path === v.path).sort((a, b) => a.seq - b.seq);
    const i = page.indexOf(v);
    const neighbours = [page[i - 1], page[i + 1]].filter(Boolean);
    const otherCopy = new Set(page.filter((x) => x !== v).map(copyKey));
    const check = async (cand, drawn) => {
      const issue = designIssue(cand);
      if (issue) return issue;
      if (neighbours.some((n) => n.layout === cand.layout || n.palette === cand.palette)) return 'shares a layout or palette with the page\'s neighbouring pin';
      if (!drawn) return null;
      return layoutIssue(cand, drawn.shape) || thumbnailIssue(cand, drawn.text) || nearIssue(await dHash(fs.readFileSync(path.join(ROOT, 'public', drawn.image.path))), recent);
    };
    // As it is, when its drawn image and metrics exist.
    let firstReason = null;
    let chosen = null;
    if (v.image?.text && fs.existsSync(fileOf(v))) {
      firstReason = await check(v, { image: v.image, text: v.image.text, shape: v.image.shape });
      if (!firstReason) chosen = v;
    }
    if (!chosen) {
      const copies = isQuestion(v) ? [v] : [v, ...anglesFor(v.path).filter((a) => !otherCopy.has(copyKey(a)) && copyKey(a) !== copyKey(v))];
      const topic = isQuestion(v) ? v.topic : topicFor(v.path);
      // A page's pins each show a different photo: photos its other pins do not use go first.
      const usedByPage = new Set(page.filter((x) => x !== v).map((x) => norm(x.art)));
      const arts = (topic ? [...new Set([norm(v.art), ...topicImages(topic)])].filter((a) => topicImages(topic).includes(a)) : [v.art]).sort((a, b) => Number(usedByPage.has(a)) - Number(usedByPage.has(b)));
      const skins = [[v.layout, v.palette], ...LAYOUTS.flatMap((l) => Object.keys(PALETTES).map((p) => [l, p]))].filter(([l, p], k, list) => list.findIndex(([a, b]) => a === l && b === p) === k);
      let renders = 0;
      search: for (const copy of copies) {
        const base = { ...v, eyebrow: copy.eyebrow, headline: copy.headline, subline: copy.subline, title: copy.title, description: copy.description, topic: topic ?? v.topic };
        const cheap = salesIssue(base) || copyIssue(base);
        if (cheap) { firstReason ||= cheap; continue; }
        for (const [layout, palette] of skins) {
          for (const art of arts.slice(0, 3)) {
            const cand = { ...base, layout, palette, art };
            const pre = await check(cand, null);
            if (pre) { firstReason ||= pre; continue; }
            if (renders++ >= MAX_RENDERS_PER_PIN) break search;
            const drawn = await render(cand);
            const issue = await check(cand, drawn);
            if (issue) { firstReason ||= issue; continue; }
            chosen = { ...cand, image: { ...drawn.image, text: drawn.text, shape: drawn.shape } };
            break search;
          }
        }
      }
    }
    if (!chosen) {
      held.push({ id: v.id, path: v.path, headline: flat(v.headline), reason: firstReason ?? 'no version passed' });
      const f = fileOf(v);
      if (f && fs.existsSync(f)) fs.unlinkSync(f);
      continue;
    }
    if (chosen !== v) {
      reworked.push({ id: v.id, from: `${v.layout}/${v.palette} ${v.art} "${flat(v.headline)}"`, to: `${chosen.layout}/${chosen.palette} ${chosen.art} "${flat(chosen.headline)}"`, reason: firstReason });
      Object.assign(v, chosen);
    }
    kept.push(v);
  }
  const heldIds = new Set(held.map((h) => h.id));
  queue.variants = queue.variants.filter((v) => !heldIds.has(v.id));
  queue.held = [...(queue.held ?? []), ...held.map((h) => ({ ...h, at: today }))];
  return { reworked, held };
}

/**
 * Gate, and when a pin is held re-pack the schedule from tomorrow so no day is short, then
 * gate the new order again (at most 3 passes). Prints PIN_QUALITY_HOLD for held pins.
 */
export async function gateAndReschedule(queue, today, opts = {}) {
  const all = { reworked: [], held: [] };
  for (let pass = 0; pass < 3; pass++) {
    const r = await gateQueue(queue, today, opts);
    all.reworked.push(...r.reworked); all.held.push(...r.held);
    if (!r.held.length) break;
    for (const v of queue.variants) if (v.release_date && v.release_date > today) v.release_date = null;
    scheduleVariants(queue.variants, { pinsPerDay: queue.config.pins_per_day, firstDay: [queue.config.drip_start, addDays(today, 1)].sort().pop() });
  }
  for (const w of all.reworked) console.log(`[pin-quality] reworked ${w.id}: ${w.from} -> ${w.to} (${w.reason})`);
  if (all.held.length) {
    const note = `${all.held.length} pin(s) held, no version passed the quality gate: ${all.held.map((h) => `${h.id} (${h.reason})`).join('; ')}`;
    console.log(`PIN_QUALITY_HOLD: ${note}`);
    if (process.env.GITHUB_ACTIONS) console.log(`::warning title=PIN_QUALITY_HOLD::${note.slice(0, 900)}`);
  }
  return all;
}

/**
 * Every failure of the pins not yet released and of the pins awaiting her approval
 * (queue.pending), for the guard test (no rework): image files + stored metrics, plus the
 * spread rule over the dated schedule. Frozen (approved-as-drawn) pins are skipped.
 * `{ all: true }` audits every pin, frozen ones too (the test proves the gate fails them).
 */
export async function auditQueue(queue, today, { all = false } = {}) {
  const hashes = new Map();
  const out = [];
  const seen = [];
  const pending = new Set(queue.pending ?? []);
  for (const v of [...queue.variants, ...(queue.questions ?? []), ...(queue.pending ?? [])].sort(byRelease)) {
    const hash = await hashFile(hashes, v);
    if (!(v.release_date && v.release_date <= today) && (all || !isFrozen(v, queue.config))) {
      const issue = designIssue(v) || layoutIssue(v) || thumbnailIssue(v) || (!hash ? `image missing: ${v.image?.path}` : pending.has(v) ? null : nearIssue(hash, seen.slice(-RECENT_WINDOW)));
      if (issue) out.push(`${v.id}: ${issue}`);
    }
    if (hash && !pending.has(v)) seen.push(hash);
  }
  for (const p of spreadViolations([...queue.variants, ...(queue.questions ?? [])], addDays(today, 1))) out.push(`spread: ${p}`);
  return out;
}

/**
 * A new search-loop question pin, released the day it is made: draw it in the first look
 * that passes the gate against the pins already released (its copy is the real search and
 * stays as it is). Returns the pin with its image, or { held: reason }.
 */
export async function gateNewPin(pin, queue, today, { render = renderToFile } = {}) {
  const hashes = new Map();
  const released = [...queue.variants, ...(queue.questions ?? [])].filter((v) => v.release_date && v.release_date <= today).sort(byRelease);
  const recent = (await Promise.all(released.slice(-RECENT_WINDOW).map((x) => hashFile(hashes, x)))).filter(Boolean);
  const cheap = designIssue(pin);
  if (cheap) return { held: cheap };
  let reason = null;
  const arts = [...new Set([norm(pin.art), ...topicImages(pin.topic)])];
  for (const [layout, palette] of [[pin.layout, pin.palette], ...LAYOUTS.flatMap((l) => Object.keys(PALETTES).map((p) => [l, p]))]) {
    for (const art of arts.slice(0, 3)) {
      const cand = { ...pin, layout, palette, art };
      const drawn = await render(cand);
      const issue = layoutIssue(cand, drawn.shape) || thumbnailIssue(cand, drawn.text) || nearIssue(await dHash(fs.readFileSync(path.join(ROOT, 'public', drawn.image.path))), recent);
      if (!issue) return { ...cand, image: { ...drawn.image, text: drawn.text, shape: drawn.shape } };
      reason ||= issue;
    }
  }
  const f = path.join(ROOT, 'public', `/pinterest/drip/${pin.id}.jpg`);
  if (fs.existsSync(f)) fs.unlinkSync(f);
  return { held: reason };
}
