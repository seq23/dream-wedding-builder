// Pin quality gate for the Pinterest daily drip (her call 6 Nov 2026: "approve all, make
// them good"; same shape as ApprovalPrep's gate, #89). A pin may stay scheduled only if:
//   1. LOOK: its image differs from the account's recent pins. A 256-bit difference hash
//      (dHash, 17x16 grayscale) is at least MIN_DISTANCE bits from each of the
//      RECENT_WINDOW pins released just before it (calibration in MIN_DISTANCE below).
//   2. TOPIC: its art is one of its page's topic images (data/pinterest/topic_art.json):
//      a destination pin shows travel, a seating pin shows tables. A page with no topic
//      mapped gets no pins (NO_TOPIC_ART).
//   3. HEADLINE: it states the searcher's benefit in the page's own search words: at least
//      MIN_HEADLINE_WORDS words, one distinctive word of a search the page answers
//      (topic_art.json pages.<path>.search), and at least MIN_BEYOND_LABEL words beyond the
//      page's own name and searches, so a bare label ("Destination Wedding Checklist") or a
//      vague one ("Finalize & Hand Off") fails. A search-loop question pin is the real
//      search itself, so it needs only the search word.
//   4. THUMBNAIL: every text role was drawn uncut and stays readable on a 236px-wide phone
//      thumbnail: headline >= 14px, other text >= 10px there, contrast >= 4.5:1.
// A failing pin is redrawn with the page's other unused copy, other layouts and palettes
// and its topic's other images; the first version that passes is kept. If none does it is
// held (removed from the schedule, recorded in queue.held, named in PIN_QUALITY_HOLD) and
// never posted. Released pins are never touched.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { addDays, scheduleVariants } from '../../lib/pinqueue.mjs';
import { anglesFor, pageSource, searchesFor, topicFor, topicImages } from './pin_sources.mjs';
import { LAYOUTS, PALETTES, renderToFile } from './render_pin.mjs';

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

export function headlineIssue(v) {
  const hw = words(v.headline);
  if (hw.length < MIN_HEADLINE_WORDS) return `headline "${flat(v.headline)}" has ${hw.length} words, need >= ${MIN_HEADLINE_WORDS} to say what the searcher gets`;
  const terms = searchTerms(v);
  if (!terms.length) return `no searches recorded for ${v.path} (data/pinterest/topic_art.json pages.search)`;
  if (!hw.some((w) => !GENERIC.has(w) && terms.some((t) => same(w, t)))) return `headline "${flat(v.headline)}" names none of its page's search words (${terms.join(', ')})`;
  if (isQuestion(v)) return null;
  const label = new Set([...words(pageSource(v.path)?.name), ...terms]);
  const beyond = hw.filter((w) => !GENERIC.has(w) && ![...label].some((l) => same(w, l)));
  if (beyond.length < MIN_BEYOND_LABEL) return `headline "${flat(v.headline)}" only restates the page's name (${beyond.length} word(s) beyond it, need >= ${MIN_BEYOND_LABEL}): it must say what the searcher gets`;
  return null;
}

export function topicIssue(v) {
  const expected = isQuestion(v) ? v.topic : topicFor(v.path);
  if (!expected) return `NO_TOPIC_ART: no topic art mapped for ${v.path}; add it to data/pinterest/topic_art.json`;
  if (v.topic !== expected) return `topic "${v.topic ?? 'none'}" is not its page's topic "${expected}"`;
  if (!topicImages(expected).includes(norm(v.art))) return `art ${v.art} is not one of the "${expected}" topic images`;
  return null;
}

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
    if (px < floor) return `${t.role} is ${px.toFixed(1)}px on a ${THUMB_WIDTH}px thumbnail, need >= ${floor}px`;
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
    if (v.release_date && v.release_date <= today) { kept.push(v); continue; }
    const recent = (await Promise.all(kept.slice(-RECENT_WINDOW).map((x) => hashFile(hashes, x)))).filter(Boolean);
    const page = queue.variants.filter((x) => x.path === v.path).sort((a, b) => a.seq - b.seq);
    const i = page.indexOf(v);
    const neighbours = [page[i - 1], page[i + 1]].filter(Boolean);
    const otherCopy = new Set(page.filter((x) => x !== v).map(copyKey));
    const check = async (cand, drawn) => {
      const issue = topicIssue(cand) || headlineIssue(cand);
      if (issue) return issue;
      if (neighbours.some((n) => n.layout === cand.layout || n.palette === cand.palette)) return 'shares a layout or palette with the page\'s neighbouring pin';
      if (!drawn) return null;
      return thumbnailIssue(cand, drawn.text) || nearIssue(await dHash(fs.readFileSync(path.join(ROOT, 'public', drawn.image.path))), recent);
    };
    // As it is, when its drawn image and metrics exist.
    let firstReason = null;
    let chosen = null;
    if (v.image?.text && fs.existsSync(fileOf(v))) {
      firstReason = await check(v, { image: v.image, text: v.image.text });
      if (!firstReason) chosen = v;
    }
    if (!chosen) {
      const copies = isQuestion(v) ? [v] : [v, ...anglesFor(v.path).filter((a) => !otherCopy.has(copyKey(a)) && copyKey(a) !== copyKey(v))];
      const topic = isQuestion(v) ? v.topic : topicFor(v.path);
      const arts = topic ? [...new Set([norm(v.art), ...topicImages(topic)])].filter((a) => topicImages(topic).includes(a)) : [v.art];
      const skins = [[v.layout, v.palette], ...LAYOUTS.flatMap((l) => Object.keys(PALETTES).map((p) => [l, p]))].filter(([l, p], k, list) => list.findIndex(([a, b]) => a === l && b === p) === k);
      let renders = 0;
      search: for (const copy of copies) {
        const base = { ...v, eyebrow: copy.eyebrow, headline: copy.headline, subline: copy.subline, title: copy.title, description: copy.description, topic: topic ?? v.topic };
        const cheap = topicIssue({ ...base, art: arts[0] }) || headlineIssue(base);
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
            chosen = { ...cand, image: { ...drawn.image, text: drawn.text } };
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

/** Every unreleased pin's failures, for the guard test (no rework): image files + stored metrics. */
export async function auditQueue(queue, today) {
  const hashes = new Map();
  const out = [];
  const seen = [];
  for (const v of [...queue.variants, ...(queue.questions ?? [])].sort(byRelease)) {
    const hash = await hashFile(hashes, v);
    if (!(v.release_date && v.release_date <= today)) {
      const issue = topicIssue(v) || headlineIssue(v) || thumbnailIssue(v) || (hash ? nearIssue(hash, seen.slice(-RECENT_WINDOW)) : `image missing: ${v.image?.path}`);
      if (issue) out.push(`${v.id}: ${issue}`);
    }
    if (hash) seen.push(hash);
  }
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
  const cheap = topicIssue(pin) || headlineIssue(pin);
  if (cheap) return { held: cheap };
  let reason = null;
  const arts = [...new Set([norm(pin.art), ...topicImages(pin.topic)])];
  for (const [layout, palette] of [[pin.layout, pin.palette], ...LAYOUTS.flatMap((l) => Object.keys(PALETTES).map((p) => [l, p]))]) {
    for (const art of arts.slice(0, 3)) {
      const cand = { ...pin, layout, palette, art };
      const drawn = await render(cand);
      const issue = thumbnailIssue(cand, drawn.text) || nearIssue(await dHash(fs.readFileSync(path.join(ROOT, 'public', drawn.image.path))), recent);
      if (!issue) return { ...cand, image: { ...drawn.image, text: drawn.text } };
      reason ||= issue;
    }
  }
  const f = path.join(ROOT, 'public', `/pinterest/drip/${pin.id}.jpg`);
  if (fs.existsSync(f)) fs.unlinkSync(f);
  return { held: reason };
}
