import rescue from '@/data/seo/page_rescue.json';
import { hrefFrom } from '@/lib/site-config';
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
import { boards, buildPinfeed, pinItems } from '@/lib/pinfeed';
import { addDays, applyFallback, applyPause, chicagoDate, decidePace, dueVariants, needsRefill, pageSlug, planRefill, scheduleVariants, type PinQueue, type PinVariant } from '@/lib/pinqueue.mjs';
import { anglesFor, derivedAngles, eligiblePaths, guideFacts, pageSource } from '../../scripts/pinterest/pin_sources.mjs';
import { LAYOUTS, LEGACY_LAYOUTS, LEGACY_PALETTES, PALETTES } from '../../scripts/pinterest/render_pin.mjs';
import { auditQueue } from '../../scripts/pinterest/quality.mjs';

const HOST = 'weddingchecklistpdf.com';
const queue = rawQueue as PinQueue;
const clone = (): PinQueue => JSON.parse(JSON.stringify(rawQueue));
const owned = new Set([...ownership.routes.filter(r => r.host === HOST).map(r => r.path), ...Object.keys(rescue.redirects).filter(path => ownership.routes.some(r => r.host === HOST && r.path === rescue.redirects[path as keyof typeof rescue.redirects]))]);
const launchPaths = pinItems.map((i) => i.path);
const dated = queue.variants.filter((v) => v.release_date) as Array<PinVariant & { release_date: string }>;

type FeedItem = { title: string; link: string; description: string; pubDate: string; enclosure: Record<string, string> | null; media: Record<string, string> | null };
const parseFeed = (xml: string): { items: FeedItem[] } => JSON.parse(execFileSync('python3', ['-I', 'scripts/pinterest/parse_feed.py'], { input: xml }).toString());
// Every board's feed together: each pin is published from exactly one of them.
const feedAt = (iso: string): FeedItem[] => {
  const feeds = boards.BOARDS.map(b => buildPinfeed(new Date(iso), b));
  const parsed = JSON.parse(execFileSync('python3', ['-I', 'scripts/pinterest/parse_feed.py', '--batch'], { input: JSON.stringify(feeds) }).toString()) as Array<{ items: FeedItem[] }>;
  expect(parsed.length).toBe(boards.BOARDS.length);
  return parsed.flatMap(feed => feed.items);
};
const PACE_SINCE = queue.config.pace!.since;

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
  it('has one release-rate value, 3 a day from 1 Nov 2026 (1 a day before), and the drip starts 17 Oct 2026', () => {
    expect(queue.config.pins_per_day).toBe(3);
    expect(PACE_SINCE).toBe('2026-11-01');
    expect(queue.config.drip_start).toBe('2026-10-17');
    expect(queue.config.timezone).toBe('America/Chicago');
    expect(queue.config.refill_threshold).toBe(42); // two weeks at 3 a day
    expect(queue.config.max_feed_items).toBe(50);
  });

  it('every page the site serves for the drip is queued, not only recorded (the 16 Oct seed queued 6 of 30)', () => {
    const queued = new Set(queue.pages.map((p) => p.path));
    for (const path of eligiblePaths()) expect(queued.has(path), path).toBe(true);
    for (const path of eligiblePaths()) expect(queue.variants.some((v) => v.path === path), path).toBe(true);
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
      // Pins published before the 6 Nov 2026 re-queue keep the old renderer's names; every
      // pin not yet released is drawn by the brand renderer.
      const released = v.release_date !== null && v.release_date <= chicagoDate();
      expect(released ? [...LAYOUTS, ...LEGACY_LAYOUTS] : LAYOUTS, v.id).toContain(v.layout);
      expect(released ? [...Object.keys(PALETTES), ...LEGACY_PALETTES] : Object.keys(PALETTES), v.id).toContain(v.palette);
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

describe('pin quality gate (her call 6 Nov 2026: "approve all, make them good")', () => {
  // Every pin not yet released must look different from the account's recent pins (dHash),
  // show its page's topic art, state the searcher's benefit in the page's search words and
  // read at a 236px thumbnail. The pins drawn before the re-queue fail it: 4 shared checklist
  // photos for 23 pages, label headlines ("Finalize & Hand Off"), no renderer text metrics.
  it('every unreleased pin passes the gate, and the gate fails the pins it replaced', async () => {
    const unreleased = queue.variants.filter((v) => !v.release_date || v.release_date > chicagoDate());
    expect(unreleased.length).toBeGreaterThanOrEqual(queue.config.refill_threshold);
    expect(await auditQueue(clone(), chicagoDate())).toEqual([]);
    // The pins drawn before the re-queue (all published by 6 Nov 2026), re-dated as if
    // still waiting: the gate holds every one of them.
    const old = clone();
    const legacy = old.variants.filter((v) => LEGACY_LAYOUTS.includes(v.layout));
    expect(legacy.length).toBeGreaterThanOrEqual(30);
    for (const v of legacy) v.release_date = '2099-01-01';
    const oldIssues = await auditQueue(old, chicagoDate());
    expect(oldIssues.filter((i) => legacy.some((v) => i.startsWith(`${v.id}:`))).length).toBe(legacy.length);
  }, 60_000);
});

describe('release schedule', () => {
  it('1 pin a day from 17 Oct 2026, pins_per_day from 1 Nov, no gaps, never the same page two days running', () => {
    expect(scheduleViolations(queue.variants, queue.config.pins_per_day).filter((p) => !p.startsWith(`${boards.SPLIT_FROM}: ${boards.BOARDS.length} pins`))).toEqual([]);
    const days = [...new Set(dated.map((v) => v.release_date))].sort();
    expect(days[0]).toBe('2026-10-17');
    for (let i = 1; i < days.length; i += 1) expect(days[i], 'gap in the schedule').toBe(addDays(days[i - 1], 1));
    const last = days.at(-1);
    for (const day of days) {
      const n = dated.filter((v) => v.release_date === day).length;
      if (day < PACE_SINCE) expect(n, day).toBe(1);
      // The board-split day carries one pin per board: Pinterest refuses to connect a feed with no items.
      else if (day === boards.SPLIT_FROM) expect(n, day).toBeLessThanOrEqual(boards.BOARDS.length);
      else if (day !== last) expect(n, day).toBe(queue.config.pins_per_day);
      else expect(n, day).toBeLessThanOrEqual(queue.config.pins_per_day);
    }
  });

  it('a refill on few pages never leaves a short day mid-schedule (13 Nov 2026 simulation: 2-pin days)', () => {
    // 6 pages with 1 pin each and 2 pages with 6 each: greedy packing runs out of distinct pages.
    const mk = (path: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${path}-${i}`, path, seq: i, release_date: null as string | null }));
    const vs = [...['a', 'b', 'c', 'd', 'e', 'f'].flatMap((p) => mk(`/${p}`, 1)), ...mk('/big1', 6), ...mk('/big2', 6)];
    scheduleVariants(vs as never, { pinsPerDay: 3, firstDay: '2026-12-01' });
    const days = [...new Set(vs.filter((v) => v.release_date).map((v) => v.release_date!))].sort();
    expect(days.length).toBeGreaterThan(0);
    for (const day of days) expect(vs.filter((v) => v.release_date === day).length, day).toBe(3);
    expect(scheduleViolations(vs as never, 3)).toEqual([]);
    expect(vs.some((v) => !v.release_date), 'leftovers wait undated for the next refill').toBe(true);
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
      expect(dripIds(items).size - dripIds(feedAt(`${addDays(day, -1)}T18:00:00Z`)).size, day).toBe(queue.variants.filter((v) => v.release_date === day).length);
    }
  });

  it('each feed lists newest first and never more than 50 items', () => {
    for (const board of boards.BOARDS) {
      const late = parseFeed(buildPinfeed(new Date('2027-12-31T18:00:00Z'), board)).items;
      expect(late.length, board.slug).toBeLessThanOrEqual(50);
      expect(late.length, board.slug).toBeGreaterThan(0);
      const dates = late.map((i) => Date.parse(i.pubDate)).filter((_, i) => new URL(late[i].link).searchParams.has('utm_content'));
      for (let i = 1; i < dates.length; i += 1) expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
    }
    expect(dueVariants(queue.variants, '2027-12-31', 50).length).toBe(Math.min(50, dated.length));
  });

  it('every link is an on-site page with the pinfeed utm params; drip links add utm_content=<variant id>', () => {
    for (const item of feedAt('2027-12-31T18:00:00Z')) {
      const link = new URL(item.link);
      expect(link.host).toBe(HOST);
      expect(link.protocol).toBe('https:');
      expect(owned.has(link.pathname) || link.pathname.startsWith('/questions/'), link.pathname).toBe(true);
      expect(link.pathname).not.toMatch(/checkout|order|api|stripe/i);
      const params = Object.fromEntries(link.searchParams);
      const base = { utm_source: 'pinterest', utm_medium: 'organic', utm_campaign: 'pinfeed' };
      if (params.utm_content) {
        const variant = [...queue.variants, ...(queue.questions ?? [])].find((v) => v.id === params.utm_content);
        expect(variant, params.utm_content).toBeTruthy(); expect(new URL(hrefFrom(HOST, variant!.path), `https://${HOST}`).pathname).toBe(link.pathname);
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

  it('triggers below refill_threshold unreleased and not at it', () => {
    const left = (today: string) => queue.variants.filter((v) => !v.release_date || v.release_date > today).length;
    const days = [...new Set(dated.map((v) => v.release_date))].sort().reverse();
    const at = days.find((d) => left(d) >= queue.config.refill_threshold)!;
    const below = days[days.indexOf(at) - 1];
    expect(needsRefill(queue, at)).toBe(false);
    expect(left(below)).toBeLessThan(queue.config.refill_threshold);
    expect(needsRefill(queue, below)).toBe(true);
  });

  it('a refill adds refill_batch new, distinct variants, fewest-variant pages first, and dates them after the queue', () => {
    const q = clone();
    const pages = q.pages.map((p) => ({ ...p, angles: anglesFor(p.path) }));
    const planned = planRefill(q, pages, q.config.refill_batch);
    expect(planned).toHaveLength(q.config.refill_batch);
    const ids = new Set(q.variants.map((v) => v.id));
    for (const v of planned) expect(ids.has(v.id), v.id).toBe(false);
    // Fewest-variant pages first: no page received a pin while another page that still had
    // an unused angle sat two or more pins behind it.
    const total = (path: string) => q.variants.filter((v) => v.path === path).length + planned.filter((v) => v.path === path).length;
    const open = pages.filter((p) => anglesFor(p.path).length > total(p.path));
    const receivers = pages.filter((p) => planned.some((v) => v.path === p.path));
    expect(receivers.length).toBeGreaterThan(1);
    if (open.length) expect(Math.max(...receivers.map((p) => total(p.path))) - Math.min(...open.map((p) => total(p.path)))).toBeLessThanOrEqual(1);
    q.variants.push(...planned);
    scheduleVariants(q.variants, { pinsPerDay: q.config.pins_per_day, firstDay: addDays(lastDay, -12) });
    // The last dated day of the queue may be part-filled; the refill tops it up first.
    expect(planned.every((v) => v.release_date && v.release_date >= lastDay)).toBe(true);
    expect(scheduleViolations(q.variants, q.config.pins_per_day).filter((p) => !p.startsWith(`${boards.SPLIT_FROM}: ${boards.BOARDS.length} pins`))).toEqual([]);
  });

  it('a page that joins later gets its pins before the old pages get more', () => {
    const q = clone();
    const joining = '/guides/elopement-planning-checklist';
    q.pages = q.pages.filter((p) => p.path !== joining);
    q.variants = q.variants.filter((v) => v.path !== joining);
    // The refill is offered only pages the site still serves, exactly as
    // scripts/pinterest/pin_queue.mjs filters them; a retired guide left in q.pages
    // with no pins is never a candidate.
    const live = q.pages.filter((p) => ownership.routes.some((r) => r.host === HOST && r.path === p.path) && !Object.hasOwn(rescue.redirects, p.path));
    const pages = [...live, { path: joining, art: ['product-images/checklist-pdf.png'], joined: '2026-11-20' }].map((p) => ({ ...p, angles: anglesFor(p.path) }));
    const planned = planRefill(q, pages, 3);
    expect(planned[0].path).toBe(joining);
  });

  it('every product and guide page the site serves has a source record, so a new one can join with truthful copy', () => {
    // Pages added since the last weekly run are not in known_pages yet; the refill adds them.
    for (const path of eligiblePaths()) expect(pageSource(path), path).not.toBeNull();
    for (const page of queue.pages) expect(derivedAngles(page.path).length, page.path).toBeGreaterThan(0);
  });
});

describe('topic boards: one feed per board, every pin in exactly one', () => {
  it('each feed carries only its own board, the topic feeds nothing released before the split', () => {
    const seen = new Map<string, string>();
    for (const board of boards.BOARDS) {
      for (const item of parseFeed(buildPinfeed(new Date('2027-12-31T18:00:00Z'), board)).items) {
        const link = new URL(item.link);
        const id = link.searchParams.get('utm_content') ?? `launch:${link.pathname}`;
        expect(seen.get(id), `${id} in ${seen.get(id)} and ${board.slug}`).toBeUndefined();
        seen.set(id, board.slug);
        if (board.slug === boards.MAIN_BOARD.slug) continue;
        const pin = [...queue.variants, ...(queue.questions ?? [])].find((v) => v.id === id)!;
        expect(pin.release_date! >= boards.SPLIT_FROM, id).toBe(true);
        expect(boards.boardFor(pin.path, pin.title).slug, id).toBe(board.slug);
      }
    }
    expect(seen.size).toBeGreaterThan(boards.BOARDS.length * 3);
  });

  it('every topic board has a pin on the split day, so its feed is not empty when connected', () => {
    for (const board of boards.BOARDS.slice(1)) {
      expect(parseFeed(buildPinfeed(new Date(`${boards.SPLIT_FROM}T18:00:00Z`), board)).items.length, board.slug).toBeGreaterThan(0);
    }
  });

  it('a question page goes to the board its words name, else the first board', () => {
    expect(boards.boardFor('/questions/a', 'how much does a courthouse wedding cost').slug).toBe('small-weddings');
    expect(boards.boardFor('/questions/b', 'when to book a wedding photographer').slug).toBe('vendors-budget');
    expect(boards.boardFor('/questions/c', 'what to put in a wedding day emergency kit').slug).toBe('wedding-day');
    expect(boards.boardFor('/questions/d', 'how to plan a wedding in 6 months').slug).toBe(boards.MAIN_BOARD.slug);
  });
});

describe('pin copy from a guide never prints a clause cut out of a sentence', () => {
  it('keeps whole short sentences and short list items, drops fragments', () => {
    const facts = guideFacts('Order early. Allow time for alterations because the order window, not the wedding date, sets the pace, which matters. Bring the license, the rings, and two witnesses.');
    expect(facts).toContain('Order early');
    expect(facts).toContain('Bring the license');
    expect(facts).toContain('Rings');
    expect(facts).toContain('Two witnesses');
    for (const f of facts) expect(f, f).not.toMatch(/^(Because|Not|Which)\b/);
  });
});

describe('stop rule: 0 visits at 4 weeks -> new format; 8 weeks -> pause (never delete)', () => {
  const week = (d: string, total: number | null, status = 'MEASURED') => ({ generated_at: `${d}T12:00:00Z`, status, total });
  const cfg = () => JSON.parse(JSON.stringify(queue.config));
  const zeros = ['2026-11-07', '2026-11-14', '2026-11-21', '2026-11-28'].map((d) => week(d, 0));

  it('keeps the pace before 4 weeks, with fewer than 4 measured weeks, or with any visit', () => {
    expect(decidePace(cfg(), zeros, '2026-11-28').action).toBe('keep');
    expect(decidePace(cfg(), zeros.slice(0, 3), '2026-11-30').action).toBe('keep');
    expect(decidePace(cfg(), [...zeros.slice(0, 3), week('2026-11-28', 1)], '2026-11-30').action).toBe('keep');
    // A named stop is not a zero.
    expect(decidePace(cfg(), [...zeros.slice(0, 3), week('2026-11-28', null, 'NAMED_STOP')], '2026-11-30').action).toBe('keep');
  });

  it('switches to the new format after 4 zero weeks, then pauses after 4 more, dropping only unreleased dates', () => {
    const c = cfg();
    const d1 = decidePace(c, zeros, '2026-11-29');
    expect(d1.action).toBe('fallback');
    applyFallback(c, '2026-11-29', d1.reason);
    expect(c.layouts).toEqual(c.pace.fallback.layouts);
    expect(c.pace.fell_back_at).toBe('2026-11-29');
    const more = ['2026-12-05', '2026-12-12', '2026-12-19', '2026-12-26'].map((d) => week(d, 0));
    expect(decidePace(c, [...zeros, ...more], '2026-12-20').action).toBe('keep');
    const d2 = decidePace(c, [...zeros, ...more], '2026-12-27');
    expect(d2.action).toBe('pause');
    const vs = [{ release_date: '2026-12-01' }, { release_date: '2026-12-30' }];
    applyPause(c, vs, '2026-12-27', d2.reason);
    expect(vs.map((v) => v.release_date)).toEqual(['2026-12-01', null]);
    expect(decidePace(c, [], '2027-01-10').action).toBe('pause');
  });
});
