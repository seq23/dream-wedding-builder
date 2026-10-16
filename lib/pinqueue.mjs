// Pinterest daily drip: the pure scheduling half (owner-approved 16 Oct 2026).
//
// data/pinterest/queue.json holds every pin variant with its release date. The
// feed route (lib/pinfeed.ts) calls dueVariants() at request time on the Worker, so
// one new pin appears each day in America/Chicago without a deploy. The weekly
// workflow (.github/workflows/pinterest-drip.yml) runs scripts/pinterest/pin_queue.mjs,
// which uses planRefill() + scheduleVariants() to add and date the next batch when
// fewer than config.refill_threshold unreleased variants remain.
//
// Plain ESM so Node scripts and the Worker import the same functions; the types
// are lib/pinqueue.d.mts (tsconfig has allowJs: false).

export const PIN_TIMEZONE = 'America/Chicago';

/** YYYY-MM-DD of `now` in America/Chicago. */
export function chicagoDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: PIN_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** '/guides/courthouse-wedding-checklist' -> 'guides-courthouse-wedding-checklist' */
export function pageSlug(path) {
  return path.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'home';
}

/** Variants released on or before `today`, newest first, at most `max`. */
export function dueVariants(variants, today, max = 50) {
  return variants
    .filter((v) => typeof v.release_date === 'string' && v.release_date <= today)
    .sort((a, b) => (a.release_date === b.release_date ? (a.id < b.id ? 1 : -1) : a.release_date < b.release_date ? 1 : -1))
    .slice(0, max);
}

export function unreleasedCount(variants, today) {
  return variants.filter((v) => !v.release_date || v.release_date > today).length;
}

export function needsRefill(queue, today) {
  return unreleasedCount(queue.variants, today) < queue.config.refill_threshold;
}

/**
 * Give every undated variant a release date: `pins_per_day` a day, starting the day
 * after the latest dated variant (never earlier than `firstDay`), and never the same
 * page on two consecutive days or twice on one day. Picks the page with the most
 * undated variants left each time, so the tail does not bunch up on one page.
 * Variants that cannot be placed without breaking the rule stay undated (and so
 * unreleased) until the next refill brings other pages. Mutates and returns them.
 */
export function scheduleVariants(variants, { pinsPerDay, firstDay }) {
  if (!Number.isInteger(pinsPerDay) || pinsPerDay < 1) throw new Error(`pins_per_day must be a positive integer, got ${pinsPerDay}`);
  const dated = variants.filter((v) => v.release_date);
  const lastDate = dated.reduce((max, v) => (v.release_date > max ? v.release_date : max), '');
  let day = lastDate && addDays(lastDate, 1) > firstDay ? addDays(lastDate, 1) : firstDay;
  // Pages already on the day before `day` (and on `day` itself, if partly filled).
  let previous = new Set(dated.filter((v) => v.release_date === addDays(day, -1)).map((v) => v.path));
  const pool = variants.filter((v) => !v.release_date).sort((a, b) => a.seq - b.seq || (a.id < b.id ? -1 : 1));
  while (pool.length) {
    const today = new Set();
    for (let slot = 0; slot < pinsPerDay; slot += 1) {
      const remaining = new Map();
      for (const v of pool) remaining.set(v.path, (remaining.get(v.path) ?? 0) + 1);
      const candidates = [...remaining.entries()].filter(([path]) => !previous.has(path) && !today.has(path));
      if (!candidates.length) break;
      candidates.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
      const path = candidates[0][0];
      const index = pool.findIndex((v) => v.path === path);
      const [variant] = pool.splice(index, 1);
      variant.release_date = day;
      today.add(path);
    }
    if (!today.size) break; // only pages that ran yesterday are left: wait for the next refill
    previous = today;
    day = addDays(day, 1);
  }
  return variants;
}

/**
 * Plan the next batch of variants (copy and design only; images are rendered by
 * scripts/pinterest/pin_queue.mjs). `pages` is [{ path, angles: [...] }] in queue
 * order. Pages with the fewest variants go first, so a page that just joined gets
 * pins before the old ones get more. Each page's next variant takes its next unused
 * angle and the next layout/palette pair, so no two variants of a page share a
 * headline and consecutive ones never share a design.
 */
export function planRefill(queue, pages, count) {
  const { layouts, palettes } = queue.config;
  const byPage = new Map(pages.map((p) => [p.path, queue.variants.filter((v) => v.path === p.path)]));
  const usedHeadlines = new Map(pages.map((p) => [p.path, new Set(byPage.get(p.path).map((v) => headlineKey(v)))]));
  let seq = queue.variants.reduce((max, v) => Math.max(max, v.seq ?? 0), 0);
  const planned = [];
  const exhausted = new Set();
  while (planned.length < count && exhausted.size < pages.length) {
    const order = pages.filter((p) => !exhausted.has(p.path)).sort((a, b) => byPage.get(a.path).length - byPage.get(b.path).length || pages.indexOf(a) - pages.indexOf(b));
    const page = order[0];
    const existing = byPage.get(page.path);
    const angle = page.angles.find((a) => !usedHeadlines.get(page.path).has(headlineKey(a)));
    if (!angle) { exhausted.add(page.path); continue; }
    const n = existing.length + 1;
    const slug = pageSlug(page.path);
    seq += 1;
    const variant = {
      id: `${slug}-${String(n).padStart(2, '0')}`,
      seq,
      path: page.path,
      eyebrow: angle.eyebrow,
      headline: angle.headline,
      subline: angle.subline,
      title: angle.title,
      description: angle.description,
      layout: layouts[(n - 1 + slugOffset(slug)) % layouts.length],
      palette: palettes[(n - 1 + 2 * slugOffset(slug)) % palettes.length],
      art: page.art[(n - 1 + slugOffset(slug)) % page.art.length],
      release_date: null
    };
    existing.push(variant);
    usedHeadlines.get(page.path).add(headlineKey(angle));
    planned.push(variant);
  }
  return planned;
}

const headlineKey = (a) => `${a.headline}|${a.subline}`.toLowerCase().replace(/\s+/g, ' ');
const slugOffset = (slug) => [...slug].reduce((sum, c) => sum + c.charCodeAt(0), 0);
