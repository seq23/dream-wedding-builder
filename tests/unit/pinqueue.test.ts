// Guard: the Pinterest daily drip (owner-approved 16 Oct 2026). data/pinterest/queue.json
// holds dated pin variants; lib/pinfeed.ts shows the six launch items plus every
// variant due by today in America/Chicago, decided at request time on the Worker.
// scripts/pinterest/pin_queue.mjs refills and dates the queue weekly
// (.github/workflows/pinterest-drip.yml).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import ownership from '@/data/seo/route_ownership.json';
import rawQueue from '@/data/pinterest/queue.json';
import { buildPinfeed, pinItems } from '@/lib/pinfeed';
import { addDays, chicagoDate, dueVariants, needsRefill, pageSlug, planRefill, scheduleVariants, type PinQueue, type PinVariant } from '@/lib/pinqueue.mjs';
import { anglesFor, derivedAngles, eligiblePaths, pageSource } from '../../scripts/pinterest/pin_sources.mjs';
import { LAYOUTS, PALETTES } from '../../scripts/pinterest/render_pin.mjs';

const HOST = 'weddingchecklistpdf.com';
const queue = rawQueue as PinQueue;
const clone = (): PinQueue => JSON.parse(JSON.stringify(rawQueue));
const owned = new Set(ownership.routes.filter((r) => r.host === HOST).map((r) => r.path));
const launchPaths = pinItems.map((i) => i.path);
const dated = queue.variants.filter((v) => v.release_date) as Array<PinVariant & { release_date: string }>;

type FeedItem = { title: string; link: string; description: string; pubDate: string; enclosure: Record<string, string> | null; media: Record<string, string> | null };
const parseFeed = (xml: string): { items: FeedItem[] } => JSON.parse(execFileSync('python3', ['-I', 'scripts/pinterest/parse_feed.py'], { input: xml }).toString());
const feedAt = (iso: string) => parseFeed(buildPinfeed(new Date(iso))).items;

/** Every violation of "never the same page on consecutive days, at most pins_per_day a day". */
function scheduleViolations(variants: Array<{ path: string; release_date: string | null }>, pinsPerDay: number): string[] {
  const byDay = new Map<string, string[]>();
  for (const v of variants) if (v.release_date) byDay.set(v.release_date, [...(byDay.get(v.release_date) ?? []), v.path]);
  const problems: string[] = [];
  for (const [day, paths] of byDay) {
    if (paths.length > pinsPerDay) problems.push(`${day}: ${paths.length} pins, pins_per_day is ${pinsPerDay}`);
    if (new Set(paths).size !== paths.length) problems.push(`${day}: one page twice`);
    for (const p of byDay.get(addDays(day, -1)) ?? []) if (paths.includes(p)) problems.push(`${p} on ${addDays(day, -1)} and ${day}`);
  }
  return problems;
}

describe('pin queue schema', () => {
  it('has one release-rate value, set to 1 a day, and the drip starts 17 Oct 2026', () => {
    expect(queue.config.pins_per_day).toBe(1);
    expect(queue.config.drip_start).toBe('2026-10-17');
    expect(queue.config.timezone).toBe('America/Chicago');
    expect(queue.config.refill_threshold).toBe(14);
    expect(queue.config.max_feed_items).toBe(50);
  });

  it('queues 6-8 variants for every launch page and at least 20 dated variants in all', () => {
    expect(dated.length).toBeGreaterThanOrEqual(20);
    for (const path of launchPaths) {
      const n = queue.variants.filter((v) => v.path === path).length;
      expect(n, path).toBeGreaterThanOrEqual(6);
      if (queue.variants.every((v) => v.seq <= 42)) expect(n, path).toBeLessThanOrEqual(8);
    }
  });

  it('every variant is complete, distinct and truthful to its page', () => {
    const ids = new Set<string>();
    const designs = new Map<string, Set<string>>();
    for (const v of queue.variants) {
      expect(ids.has(v.id), v.id).toBe(false);
      ids.add(v.id);
      expect(v.id).toMatch(new RegExp(`^${pageSlug(v.path)}-\\d{2,}$`));
      expect(owned.has(v.path), v.path).toBe(true);
      expect(queue.pages.some((p) => p.path === v.path), v.path).toBe(true);
      for (const field of ['eyebrow', 'headline', 'subline', 'title', 'description'] as const) expect(v[field].trim().length, `${v.id}.${field}`).toBeGreaterThan(0);
      expect(v.title.length, v.id).toBeLessThanOrEqual(100);
      expect(v.description.length, v.id).toBeLessThanOrEqual(500);
      expect(LAYOUTS).toContain(v.layout);
      expect(Object.keys(PALETTES)).toContain(v.palette);
      expect(existsSync(join('public', v.art)), v.art).toBe(true);
      expect(v.release_date === null || /^\d{4}-\d{2}-\d{2}$/.test(v.release_date)).toBe(true);
      if (v.release_date) expect(v.release_date >= queue.config.drip_start, v.id).toBe(true);
      // No prices (they can drift from the live price) and no number the page does not state.
      const copy = [v.eyebrow, v.headline, v.subline, v.title, v.description].join(' ');
      expect(copy, v.id).not.toMatch(/\$|€|£/);
      const source = pageSource(v.path);
      expect(source, v.path).not.toBeNull();
      for (const n of copy.match(/\d+/g) ?? []) expect(source!.text, `${v.id}: "${n}" is not on ${v.path}`).toMatch(new RegExp(`(^|\\D)${n}(\\D|$)`));
      const key = `${v.headline}|${v.subline}`.toLowerCase();
      const seen = designs.get(v.path) ?? new Set();
      expect(seen.has(key), `${v.id} repeats a headline on ${v.path}`).toBe(false);
      designs.set(v.path, seen.add(key));
    }
  });

  it('consecutive variants of one page never share a layout or a palette', () => {
    for (const page of queue.pages) {
      const vs = queue.variants.filter((v) => v.path === page.path).sort((a, b) => a.seq - b.seq);
      for (let i = 1; i < vs.length; i += 1) {
        expect(vs[i].layout, vs[i].id).not.toBe(vs[i - 1].layout);
        expect(vs[i].palette, vs[i].id).not.toBe(vs[i - 1].palette);
      }
    }
  });

  it('every image exists at 1000x1500 and its declared length is its byte size', async () => {
    for (const v of queue.variants) {
      expect(v.image, v.id).toBeTruthy();
      const file = join('public', v.image!.path);
      expect(existsSync(file), file).toBe(true);
      expect(v.image!.length, file).toBe(statSync(file).size);
      const meta = await sharp(readFileSync(file)).metadata();
      expect({ w: meta.width, h: meta.height, type: `image/${meta.format}` }, file).toEqual({ w: 1000, h: 1500, type: v.image!.type });
    }
  });
});

describe('release schedule', () => {
  it('one pin a day from 17 Oct 2026 with no gaps, and never the same page two days running', () => {
    expect(scheduleViolations(queue.variants, queue.config.pins_per_day)).toEqual([]);
    const days = [...new Set(dated.map((v) => v.release_date))].sort();
    expect(days[0]).toBe('2026-10-17');
    for (let i = 1; i < days.length; i += 1) expect(days[i], 'gap in the schedule').toBe(addDays(days[i - 1], 1));
    for (const day of days) expect(dated.filter((v) => v.release_date === day).length, day).toBe(queue.config.pins_per_day);
  });

  it('the scheduler keeps the rule when pins_per_day is raised', () => {
    for (const pinsPerDay of [1, 2, 3]) {
      const q = clone();
      for (const v of q.variants) v.release_date = null;
      scheduleVariants(q.variants, { pinsPerDay, firstDay: '2026-10-17' });
      expect(scheduleViolations(q.variants, pinsPerDay), `pins_per_day ${pinsPerDay}`).toEqual([]);
      expect(q.variants.filter((v) => v.release_date).length).toBeGreaterThan(q.variants.length - 2 * pinsPerDay);
    }
  });

  it('the check itself catches the same page on consecutive days', () => {
    expect(scheduleViolations([{ path: '/a', release_date: '2026-10-17' }, { path: '/a', release_date: '2026-10-18' }], 1)).toHaveLength(1);
  });
});

describe('feed at a fixed clock', () => {
  const dueIds = (today: string) => new Set(queue.variants.filter((v) => v.release_date && v.release_date <= today).map((v) => v.id));
  const dripIds = (items: FeedItem[]) => new Set(items.map((i) => new URL(i.link).searchParams.get('utm_content')).filter(Boolean));

  it('on 16 Oct 2026 shows exactly the six launch items', () => {
    const items = feedAt('2026-10-16T17:00:00Z');
    expect(items.map((i) => new URL(i.link).pathname)).toEqual(launchPaths);
    expect(dripIds(items).size).toBe(0);
  });

  it('switches day at midnight America/Chicago, one new item a day', () => {
    expect(chicagoDate(new Date('2026-10-17T04:59:00Z'))).toBe('2026-10-16');
    expect(feedAt('2026-10-17T04:59:00Z')).toHaveLength(6);
    const first = feedAt('2026-10-17T05:01:00Z');
    expect(first).toHaveLength(7);
    expect(dripIds(first)).toEqual(dueIds('2026-10-17'));
    for (const day of ['2026-10-18', '2026-10-25', '2026-11-05']) {
      const items = feedAt(`${day}T18:00:00Z`);
      expect(dripIds(items), day).toEqual(dueIds(day));
      expect(items.length, day).toBe(6 + dueIds(day).size);
      expect(dripIds(items).size - dripIds(feedAt(`${addDays(day, -1)}T18:00:00Z`)).size, day).toBe(queue.config.pins_per_day);
    }
  });

  it('lists newest first and never more than 50 items', () => {
    const late = feedAt('2027-12-31T18:00:00Z');
    expect(late.length).toBe(Math.min(50, 6 + dated.length));
    const dates = late.map((i) => Date.parse(i.pubDate)).slice(0, Math.min(dated.length, 50));
    for (let i = 1; i < dates.length; i += 1) expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
    expect(dueVariants(queue.variants, '2027-12-31', 50).length).toBe(Math.min(50, dated.length));
  });

  it('every link is an on-site page with the pinfeed utm params; drip links add utm_content=<variant id>', () => {
    for (const item of feedAt('2027-12-31T18:00:00Z')) {
      const link = new URL(item.link);
      expect(link.host).toBe(HOST);
      expect(link.protocol).toBe('https:');
      expect(owned.has(link.pathname), link.pathname).toBe(true);
      expect(link.pathname).not.toMatch(/checkout|order|api|stripe/i);
      const params = Object.fromEntries(link.searchParams);
      const base = { utm_source: 'pinterest', utm_medium: 'organic', utm_campaign: 'pinfeed' };
      if (params.utm_content) {
        const variant = queue.variants.find((v) => v.id === params.utm_content);
        expect(variant?.path, params.utm_content).toBe(link.pathname);
        expect(params).toEqual({ ...base, utm_content: variant!.id });
      } else {
        expect(launchPaths).toContain(link.pathname);
        expect(params).toEqual(base);
      }
      expect(new URL(item.enclosure!.url).host).toBe(HOST);
    }
  });
});

describe('auto-refill', () => {
  const lastDay = dated.map((v) => v.release_date).sort().pop()!;

  it('triggers below 14 unreleased and not at 14', () => {
    expect(needsRefill(queue, addDays(lastDay, -14))).toBe(false); // 14 left
    expect(needsRefill(queue, addDays(lastDay, -13))).toBe(true); // 13 left
  });

  it('a refill adds refill_batch new, distinct variants, fewest-variant pages first, and dates them after the queue', () => {
    const q = clone();
    const pages = q.pages.map((p) => ({ ...p, angles: anglesFor(p.path) }));
    const planned = planRefill(q, pages, q.config.refill_batch);
    expect(planned).toHaveLength(q.config.refill_batch);
    const ids = new Set(q.variants.map((v) => v.id));
    for (const v of planned) expect(ids.has(v.id), v.id).toBe(false);
    const counts = pages.map((p) => q.variants.filter((v) => v.path === p.path).length + planned.filter((v) => v.path === p.path).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    q.variants.push(...planned);
    scheduleVariants(q.variants, { pinsPerDay: q.config.pins_per_day, firstDay: addDays(lastDay, -12) });
    expect(planned.every((v) => v.release_date && v.release_date > lastDay)).toBe(true);
    expect(scheduleViolations(q.variants, q.config.pins_per_day)).toEqual([]);
  });

  it('a page that joins later gets its pins before the old pages get more', () => {
    const q = clone();
    const joining = '/guides/backyard-wedding-checklist';
    expect(q.pages.some((p) => p.path === joining)).toBe(false);
    const pages = [...q.pages, { path: joining, art: ['product-images/checklist-pdf.png'], joined: '2026-11-20' }].map((p) => ({ ...p, angles: anglesFor(p.path) }));
    const planned = planRefill(q, pages, 3);
    expect(planned.every((v) => v.path === joining)).toBe(true);
  });

  it('every product and guide page the site serves has a source record, so a new one can join with truthful copy', () => {
    // Pages added since the last weekly run are not in known_pages yet; the refill adds them.
    for (const path of eligiblePaths()) expect(pageSource(path), path).not.toBeNull();
    for (const page of queue.pages) expect(derivedAngles(page.path).length, page.path).toBeGreaterThan(0);
  });
});
