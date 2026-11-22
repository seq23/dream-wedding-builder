// Google Play review code (lib/review-unlock.ts) and its door (lib/app-unlock.ts): how it breaks, each case proven.
// Real SQLite from the repo's migrations (a D1 stand-in) and a fake RevenueCat v2 that keeps purchases and grants apart.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { ENTITLEMENT_IDS, REVIEW_LIMITS, purgeReviewRows, reviewStatus, reviewUnlock, type ReviewEnv } from '@/lib/review-unlock';
import { appUnlock, type UnlockEnv } from '@/lib/app-unlock';

const CODE = '4815162342', NOW = Date.parse('2026-12-01T12:00:00Z'), DAY = 86_400_000;
const anon = (n: number) => `$RCAnonymousID:${n.toString(16).padStart(32, '0')}`;
const ALL = Object.values(ENTITLEMENT_IDS);
afterEach(() => vi.restoreAllMocks());

function d1() {
  const raw = new DatabaseSync(':memory:');
  for (const f of ['0006_rate_events.sql', '0015_review_grant.sql']) raw.exec(readFileSync(`migrations/${f}`, 'utf8'));
  let down = false;
  const statement = (sql: string, args: unknown[] = []) => ({
    async run() { if (down) throw Error('D1_DOWN'); return { meta: { changes: Number(raw.prepare(sql).run(...args as never[]).changes) } }; },
    async first() { if (down) throw Error('D1_DOWN'); return (raw.prepare(sql).get(...args as never[]) as Record<string, unknown>) ?? null; },
  });
  return { raw, fail(on: boolean) { down = on; }, prepare(sql: string) { return { ...statement(sql), bind: (...a: unknown[]) => statement(sql, a) }; } };
}

/** A fake RevenueCat v2: known customers, real store purchases (never touched by grants), granted entitlements. */
function revenuecat() {
  const known = new Set<string>(), granted = new Map<string, Map<string, number>>(), purchases = new Map<string, string>();
  const calls: string[] = [];
  let mode: 'ok' | '5xx' | 'timeout' | '403' | 'second-fails' = 'ok', openLoops = 0, grantsThisCall = 0;
  const products = JSON.parse(readFileSync('tests/fixtures/revenuecat/v2-products.json', 'utf8')).body;
  const productId = (store: string) => (products.items as { id: string; store_identifier: string; app_id: string }[]).find(p => p.store_identifier === store && p.app_id === 'app630a018765')!.id;
  const fetcher = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    if (url.includes('open-loops/intake')) { openLoops++; return new Response('{}', { status: 201 }); }
    if (url.includes('/products?')) return Response.json(products);
    calls.push(`${init.method ?? 'GET'} ${url.replace(/^.*\/customers\/[^/?]+/, '')}`);
    const id = decodeURIComponent(url.split('/customers/')[1]!.split(/[/?]/)[0]!);
    const mine = granted.get(id) ?? new Map<string, number>(); granted.set(id, mine);
    if (url.endsWith('/actions/revoke_granted_entitlement')) { mine.delete(JSON.parse(String(init.body)).entitlement_id); return Response.json({}); }
    if (url.endsWith('/actions/grant_entitlement')) {
      grantsThisCall++;
      if (mode === 'timeout') { mine.set(JSON.parse(String(init.body)).entitlement_id, NOW + 1); throw Error('TimeoutError'); }
      if (mode === '5xx') return new Response('{}', { status: 502 });
      if (mode === '403') return new Response('{}', { status: 403 });
      if (mode === 'second-fails' && grantsThisCall === 2) return new Response('{}', { status: 500 });
      const body = JSON.parse(String(init.body)); mine.set(body.entitlement_id, body.expires_at);
      return Response.json({}, { status: 201 });
    }
    if (!known.has(id)) return Response.json({ type: 'resource_missing' }, { status: 404 });
    if (url.includes('/active_entitlements')) {
      const items = [...mine].map(([entitlement_id, expires_at]) => ({ object: 'customer.active_entitlement', entitlement_id, expires_at }));
      // A real (lifetime) purchase shows as an entitlement with no expiry: never counted as a review grant.
      if (purchases.has(id)) items.push(...ALL.map(entitlement_id => ({ object: 'customer.active_entitlement', entitlement_id, expires_at: null as never })));
      return Response.json({ object: 'list', items: items.filter(i => i.expires_at === null || i.expires_at > NOW), next_page: null });
    }
    if (url.includes('/purchases')) {
      const p = purchases.get(id);
      return Response.json({ object: 'list', next_page: null, items: p ? [{ object: 'purchase', id: 'purc_fictional', product_id: productId(p), purchased_at: NOW - DAY, status: 'owned', environment: 'production', store: 'play_store' }] : [] });
    }
    return Response.json({ id });
  });
  return { known, granted, purchases, calls, fetcher: fetcher as unknown as typeof fetch, set(m: typeof mode) { mode = m; }, get openLoops() { return openLoops; }, resetCall() { grantsThisCall = 0; } };
}

type Env = ReviewEnv & UnlockEnv & { DB: ReturnType<typeof d1> };
function env(over: Partial<Env> = {}): Env {
  return { REVIEW_CODE: CODE, REVIEW_CODE_VERSION: 'v1', REVIEW_UNTIL: '2027-12-01', REVIEW_HASH_SECRET: 's'.repeat(40), REVIEW_MAX_DEVICES: '10',
    REVENUECAT_SECRET: 'sk_fictional', APP_PURCHASES_ENABLED: 'true', BOSS_OPEN_LOOPS_TOKEN: 't', DOWNLOAD_SIGNING_SECRET: 'test-delivery-secret',
    PRODUCT_RELEASES: { get: vi.fn(async () => ({ body: new Blob(['fictional']).stream(), size: 9 })) }, DB: d1(), ...over } as Env;
}
const req = (body: unknown, ip = '203.0.113.7', type = 'application/json') =>
  new Request('https://weddingchecklistpdf.com/api/review/unlock', { method: 'POST', headers: { 'content-type': type, 'cf-connecting-ip': ip }, body: typeof body === 'string' ? body : JSON.stringify(body) });
async function redeem(e: Env, rc: ReturnType<typeof revenuecat>, id: string, ip?: string, now = NOW, code = CODE) {
  rc.resetCall();
  const res = await reviewUnlock(req({ code, app_user_id: id }, ip), e, rc.fetcher, now);
  return { status: res.status, body: await res.json() as { error?: string; unlocked?: boolean }, headers: res.headers };
}
const door = async (e: Env, rc: ReturnType<typeof revenuecat>, id: string, now = NOW) => {
  const res = await appUnlock(new Request('https://weddingchecklistpdf.com/api/app-unlock', { method: 'POST', headers: { authorization: `Bearer ${id}`, 'cf-connecting-ip': '198.51.100.50' } }), e, rc.fetcher, now);
  return { status: res.status, body: await res.json() as { active?: string[]; newEvents?: string[]; downloads?: { id: string }[]; error?: string } };
};
const tries = (e: Env) => Number(e.DB.raw.prepare("SELECT COUNT(*) AS n FROM rate_events WHERE bucket = 'review-all'").get()?.n ?? 0);
const slots = (e: Env) => Number(e.DB.raw.prepare('SELECT COUNT(*) AS n FROM review_grant').get()!.n);
const grantsOf = (rc: ReturnType<typeof revenuecat>, id: string) => [...(rc.granted.get(id) ?? new Map()).keys()].sort();
const quiet = () => { vi.spyOn(console, 'error').mockImplementation(() => {}); vi.spyOn(console, 'log').mockImplementation(() => {}); };

it('closed window (past, unset, malformed, no code, no key, store off, no D1): status and unlock 404, no RevenueCat call', async () => {
  quiet();
  const rc = revenuecat(); rc.known.add(anon(1));
  for (const over of [{ REVIEW_UNTIL: '2026-01-01' }, { REVIEW_UNTIL: undefined }, { REVIEW_UNTIL: 'soon' }, { REVIEW_CODE: undefined }, { REVIEW_CODE: '123456' },
    { REVENUECAT_SECRET: undefined }, { REVIEW_HASH_SECRET: 'short' }, { REVIEW_CODE_VERSION: undefined }, { APP_PURCHASES_ENABLED: undefined }, { DB: undefined }] as Partial<Env>[]) {
    const e = env(over);
    expect((reviewStatus(e, NOW)).status, JSON.stringify(over)).toBe(404);
    expect((await redeem(e, rc, anon(1))).status).toBe(404);
  }
  expect(rc.calls).toEqual([]);
  const open = reviewStatus(env(), NOW);
  expect(open.status).toBe(200);
  expect(open.headers.get('cache-control')).toBe('no-store');
});

it('the right code grants all three entitlements for min(7 days, window) to a known ID; the door then delivers every paid part and one event', async () => {
  quiet();
  const e = env(), rc = revenuecat(); rc.known.add(anon(1));
  const r = await redeem(e, rc, anon(1));
  expect(r.body).toEqual({ unlocked: true });
  expect(grantsOf(rc, anon(1))).toEqual([...ALL].sort());
  for (const id of ALL) expect(rc.granted.get(anon(1))!.get(id)).toBe(NOW + 7 * DAY);
  const d = await door(e, rc, anon(1));
  expect(d.status).toBe(200);
  expect(d.body.active).toEqual(['full_plan', 'printables', 'day_of_kit']);
  expect(d.body.downloads!.map(x => x.id)).toEqual(expect.arrayContaining(['full-plan', 'tradition-hindu', 'printables', 'day-of-kit']));
  expect(d.body.downloads).toHaveLength(10);
  expect(d.body.newEvents).toHaveLength(1);
  // The event token is fixed: asking again never mints a second event.
  expect((await door(e, rc, anon(1))).body.newEvents).toEqual(d.body.newEvents);
  // The grant never outlives the window.
  const e2 = env({ REVIEW_UNTIL: '2026-12-03T00:00:00Z' }), rc2 = revenuecat(); rc2.known.add(anon(2));
  await redeem(e2, rc2, anon(2));
  expect(rc2.granted.get(anon(2))!.get(ENTITLEMENT_IDS.full_plan)).toBe(Date.parse('2026-12-03T00:00:00Z'));
  // The code never appears in a response or a log line.
  const log = vi.mocked(console.error).mock.calls.concat(vi.mocked(console.log).mock.calls).flat().join(' ');
  expect(JSON.stringify(r.body) + JSON.stringify(d.body) + log).not.toContain(CODE);
});

it('guessing: wrong code 403 and counted; burst 5/min, 20/IP/day and the global cap all refuse BEFORE the compare', async () => {
  quiet();
  const e = env(), rc = revenuecat(); rc.known.add(anon(1));
  expect((await redeem(e, rc, anon(1), undefined, NOW, '0000000000')).body.error).toBe('WRONG_CODE');
  expect(tries(e)).toBe(1);
  const b = env(), rcb = revenuecat(); rcb.known.add(anon(1));
  for (let i = 0; i < REVIEW_LIMITS.burst.max; i++) await redeem(b, rcb, anon(1), undefined, NOW, '0000000000');
  const burst = await redeem(b, rcb, anon(1));
  expect(burst.status).toBe(429); expect(rcb.calls).toEqual([]);
  const d = env(), rcd = revenuecat(); rcd.known.add(anon(1));
  for (let i = 0; i < REVIEW_LIMITS.perIp.max; i++) expect((await redeem(d, rcd, anon(1), undefined, NOW + i * 61_000, '0000000000')).status).toBe(403);
  const late = await redeem(d, rcd, anon(1), undefined, NOW + 30 * 61_000);
  expect(late.status).toBe(429); expect(rcd.calls).toEqual([]);
  expect((await redeem(d, rcd, anon(1), '198.51.100.9', NOW + 31 * 61_000)).status).toBe(200);
  const g = env(), rcg = revenuecat(); rcg.known.add(anon(1));
  const insert = g.DB.raw.prepare("INSERT INTO rate_events VALUES ('review-all', 'all', ?)");
  for (let i = 0; i < REVIEW_LIMITS.global.max; i++) insert.run(Math.floor(NOW / 1000) - 10);
  const global = await redeem(g, rcg, anon(1));
  expect(global.status).toBe(429); expect(rcg.calls).toEqual([]);
});

it('lying client: malformed, custom or oversized IDs and bodies are refused before any count or call; a made-up ID takes no slot', async () => {
  quiet();
  const e = env(), rc = revenuecat();
  for (const body of [{ code: CODE, app_user_id: 'her@email.com' }, { code: CODE, app_user_id: '$RCAnonymousID:xyz' }, { code: CODE }, { app_user_id: anon(1) },
    { code: 4815162342, app_user_id: anon(1) }, 'not json', JSON.stringify({ code: CODE, app_user_id: anon(1), pad: 'x'.repeat(2000) })])
    expect((await reviewUnlock(req(body), e, rc.fetcher, NOW)).status).toBe(400);
  expect((await reviewUnlock(req({ code: CODE, app_user_id: anon(1) }, undefined, 'text/plain'), e, rc.fetcher, NOW)).status).toBe(400);
  expect(tries(e)).toBe(0); expect(rc.calls).toEqual([]);
  const r = await redeem(e, rc, anon(99));
  expect(r.status).toBe(503); expect(slots(e)).toBe(0); expect(grantsOf(rc, anon(99))).toEqual([]);
});

it('leaked code: 10 phones per code version, 2 new per IP a day, the 11th files an Open Loops row; the same ID again takes no slot', async () => {
  quiet();
  const e = env(), rc = revenuecat();
  for (let n = 1; n <= 12; n++) rc.known.add(anon(n));
  expect((await redeem(e, rc, anon(1), '192.0.2.1')).status).toBe(200);
  expect((await redeem(e, rc, anon(2), '192.0.2.1')).status).toBe(200);
  const third = await redeem(e, rc, anon(3), '192.0.2.1');
  expect(third.body.error).toBe('USED_UP'); expect(slots(e)).toBe(2); expect(grantsOf(rc, anon(3))).toEqual([]);
  // After its 7 days (row not yet purged): no new slot, a fresh grant.
  const again = await redeem(e, rc, anon(1), '192.0.2.1', NOW + 8 * DAY);
  expect(again.status).toBe(200); expect(slots(e)).toBe(2);
  expect(rc.granted.get(anon(1))!.get(ENTITLEMENT_IDS.day_of_kit)).toBe(NOW + 15 * DAY);
  for (let n = 3; n <= 10; n++) expect((await redeem(e, rc, anon(n), `198.51.100.${n}`)).status).toBe(200);
  expect(slots(e)).toBe(10);
  const eleventh = await redeem(e, rc, anon(11), '198.51.100.200');
  expect(eleventh.body.error).toBe('USED_UP'); expect(slots(e)).toBe(10); expect(grantsOf(rc, anon(11))).toEqual([]);
  expect(rc.openLoops).toBe(1);
  expect(vi.mocked(console.error).mock.calls.flat().join(' ')).toContain('REVIEW_DEVICE_CAP');
  // A new code version is a new window with its own 10 slots.
  expect((await redeem({ ...e, REVIEW_CODE_VERSION: 'v2' }, rc, anon(11), '198.51.100.201')).status).toBe(200);
});

it('outage: RevenueCat 5xx, timeout, read-only key or one of three grants failing = 503, all revoked, slot given back; D1 down = 503', async () => {
  quiet();
  for (const mode of ['5xx', 'timeout', '403', 'second-fails'] as const) {
    const e = env(), rc = revenuecat(); rc.known.add(anon(1)); rc.known.add(anon(2)); rc.set(mode);
    const r = await redeem(e, rc, anon(1));
    expect(r.status, mode).toBe(503); expect(r.body.error).toBe('TRY_AGAIN');
    expect(slots(e), mode).toBe(0); expect(grantsOf(rc, anon(1)), `${mode}: nothing half-granted`).toEqual([]);
    expect((await door(e, rc, anon(1))).status, mode).toBe(403);
    if (mode === '403') expect(vi.mocked(console.error).mock.calls.flat().join(' ')).toContain('REVIEW_RC_KEY_READONLY');
    // The slot really came back: the same IP can still open its two new phones.
    rc.set('ok');
    expect((await redeem(e, rc, anon(1))).status).toBe(200);
    expect((await redeem(e, rc, anon(2))).status).toBe(200);
  }
  const e = env(), rc = revenuecat(); rc.known.add(anon(1)); e.DB.fail(true);
  expect((await redeem(e, rc, anon(1))).status).toBe(503); expect(rc.calls).toEqual([]);
});

it('doors: a forged, expired, revoked, closed-window, old-version or row-less grant is refused exactly like "no purchase"', async () => {
  quiet();
  const rc = revenuecat(); rc.known.add(anon(1)); rc.known.add(anon(9));
  const nothing = await door(env(), rc, anon(9));
  expect(nothing.status).toBe(403);
  const e = env(); await redeem(e, rc, anon(1));
  const same = (r: { status: number; body: unknown }) => { expect(r.status).toBe(nothing.status); expect(r.body).toEqual(nothing.body); };
  // Expired (past the row's expires_at), closed window, old code version.
  same(await door(e, rc, anon(1), NOW + 7 * DAY + 1));
  same(await door({ ...e, REVIEW_UNTIL: '2026-11-30' }, rc, anon(1)));
  same(await door({ ...e, REVIEW_CODE_VERSION: 'v2' }, rc, anon(1)));
  // Revoked in RevenueCat: the row alone opens nothing.
  rc.granted.get(anon(1))!.clear();
  same(await door(e, rc, anon(1)));
  // A dated entitlement with no review_grant row (a sandbox or Test Store grant, or a forged one) opens nothing.
  rc.granted.set(anon(9), new Map(ALL.map(id => [id, NOW + DAY])));
  same(await door(e, rc, anon(9)));
  // A reservation (expires_at 0, grants still being made) opens nothing.
  const e3 = env(), rc3 = revenuecat(); rc3.known.add(anon(3));
  e3.DB.raw.prepare("INSERT INTO review_grant VALUES ('v1', ?, ?, 0)").run(await (await import('@/lib/review-unlock')).reviewIdHash(e3, anon(3)), NOW);
  rc3.granted.set(anon(3), new Map(ALL.map(id => [id, NOW + DAY])));
  expect((await door(e3, rc3, anon(3))).status).toBe(403);
  // Review storage unreadable at the door: review grants fail closed (and all of D1 down is the door's existing 503).
  const e4 = env(), rc4 = revenuecat(); rc4.known.add(anon(4)); await redeem(e4, rc4, anon(4));
  e4.DB.raw.exec('ALTER TABLE review_grant RENAME TO gone');
  expect((await door(e4, rc4, anon(4))).status).toBe(403);
  e4.DB.fail(true);
  expect((await door(e4, rc4, anon(4))).status).toBe(503);
});

it('data loss: a buyer who redeems keeps the purchase; window closed, expiry or a failed grant never hide it; only GRANTED entitlements are ever revoked', async () => {
  quiet();
  const e = env(), rc = revenuecat(); rc.known.add(anon(1)); rc.purchases.set(anon(1), 'dw_planner_printables');
  expect((await redeem(e, rc, anon(1))).status).toBe(200);
  rc.set('timeout'); await redeem(e, rc, anon(1));
  expect(rc.purchases.get(anon(1))).toBe('dw_planner_printables');
  for (const at of [NOW, NOW + 30 * DAY]) for (const over of [{}, { REVIEW_UNTIL: '2026-11-30' }, { REVIEW_CODE: undefined }]) {
    const d = await door({ ...e, ...over } as Env, rc, anon(1), at);
    expect(d.status).toBe(200); expect(d.body.active).toEqual(['full_plan', 'printables', 'day_of_kit']);
  }
  // Review storage unreadable: the buyer is unaffected (review rows are only read for the review part).
  e.DB.raw.exec('ALTER TABLE review_grant RENAME TO gone');
  expect((await door(e, rc, anon(1))).status).toBe(200);
  e.DB.raw.exec('ALTER TABLE gone RENAME TO review_grant');
  expect(rc.calls.every(c => /^GET |\/actions\/(grant_entitlement|revoke_granted_entitlement)$/.test(c)), rc.calls.join('\n')).toBe(true);
  // Stored: HMACs only, no raw ID or IP; purge removes rows 7 days past expiry and old try counters.
  const dump = JSON.stringify(e.DB.raw.prepare('SELECT * FROM review_grant').all()) + JSON.stringify(e.DB.raw.prepare('SELECT * FROM rate_events').all());
  expect(dump).not.toContain(anon(1).slice(15)); expect(dump).not.toContain('203.0.113.7');
  await purgeReviewRows(e.DB, NOW + 7 * DAY + 7 * DAY + 1);
  expect(slots(e)).toBe(0);
  expect(Number(e.DB.raw.prepare("SELECT COUNT(*) AS n FROM rate_events WHERE bucket LIKE 'review-%'").get()!.n)).toBe(0);
});

it('two taps from one phone at once: the loser is a repeat (fresh grant), never a false device cap or Open Loops row', async () => {
  quiet();
  const e = env(), rc = revenuecat(); rc.known.add(anon(1));
  expect((await redeem(e, rc, anon(1))).status).toBe(200);
  // The second tap's first look misses the row (the first tap had not written it yet).
  const real = e.DB.prepare.bind(e.DB); let hidden = false;
  e.DB.prepare = ((sql: string) => {
    const st = real(sql);
    if (!hidden && sql.startsWith('SELECT 1 AS x')) { hidden = true; return { ...st, bind: () => ({ ...st.bind(), first: async () => null }) }; }
    return st;
  }) as typeof e.DB.prepare;
  const second = await redeem(e, rc, anon(1));
  expect(second.status).toBe(200); expect(slots(e)).toBe(1); expect(rc.openLoops).toBe(0);
  // The per-IP new-phone allowance was given back: two more new phones still fit.
  rc.known.add(anon(2)); rc.known.add(anon(3));
  e.DB.prepare = real as typeof e.DB.prepare;
  expect((await redeem(e, rc, anon(2))).status).toBe(200);
});
