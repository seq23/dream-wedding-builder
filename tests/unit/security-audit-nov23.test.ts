import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { NextRequest } from 'next/server';

// Security audit 23 Nov 2026, the two open rows in this repo's code:
//   - /api/health/email and /api/health/delivery handed any stranger the sign-up totals, the send
//     counts and the number of undelivered paid orders, and the email one ran CREATE TABLE per GET;
//   - /api/submit-trend had a honeypot and no limit, so a script could fill the review sheet.
// Every test calls the real route handler against an in-memory SQLite built from the real
// migrations. Nothing leaves the process: any fetch but the fake review endpoint throws.

type Fake = { raw: DatabaseSync; sql: string[]; broken: boolean; prepare(sql: string): any };
function fakeD1(): Fake {
  const raw = new DatabaseSync(':memory:');
  for (const file of readdirSync('migrations').sort()) raw.exec(readFileSync(`migrations/${file}`, 'utf8'));
  const db: Fake = {
    raw, sql: [], broken: false,
    prepare(sql: string) {
      if (db.broken) throw new Error('D1_ERROR: storage is unavailable');
      db.sql.push(sql);
      const stmt = (args: unknown[] = []) => ({
        async run() { const r = raw.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes) } }; },
        async all() { return { results: raw.prepare(sql).all(...(args as never[])) as Record<string, unknown>[] }; },
        async first() { return (raw.prepare(sql).get(...(args as never[])) as Record<string, unknown>) ?? null; }
      });
      return { ...stmt(), bind: (...v: unknown[]) => stmt(v) };
    }
  };
  return db;
}

const SECRET = 'test-session-secret';
const state: { db: Fake | undefined; envThrows: boolean; cookie: string | undefined } = { db: undefined, envThrows: false, cookie: undefined };
vi.mock('@/lib/cloudflare-runtime', () => ({ runtimeEnv: async () => { if (state.envThrows) throw new Error('no Cloudflare context'); return { DB: state.db }; } }));
vi.mock('next/headers', () => ({ cookies: async () => ({ set(_n: string, v: string) { state.cookie = v; }, get() { return state.cookie ? { value: state.cookie } : undefined; } }) }));

import { GET as emailGET } from '@/app/api/health/email/route';
import { GET as deliveryGET } from '@/app/api/health/delivery/route';
import { POST as trendPOST } from '@/app/api/submit-trend/route';
import { createAdminSession } from '@/lib/admin-auth';
import { LIMITS } from '@/lib/abuse-limits';
import { recordRun, type NurtureDB } from '@/lib/nurture';
import { storeBuilderSignup } from '@/lib/builder-signup';

/** A session cookie in the real format (lib/admin-auth.ts), signed with any secret, role and expiry. */
function sessionCookie(secret: string, role = 'owner', exp = Math.floor(Date.now() / 1000) + 600) {
  const payload = Buffer.from(JSON.stringify({ role, exp })).toString('base64url');
  return `${payload}.${crypto.createHmac('sha256', secret).update(payload).digest('base64url')}`;
}
const schema = (db: Fake) => JSON.stringify(db.raw.prepare('SELECT name, sql FROM sqlite_master ORDER BY name').all());
const forwarded: Record<string, unknown>[] = [];

beforeEach(() => {
  state.db = fakeD1(); state.envThrows = false; state.cookie = undefined; forwarded.length = 0;
  vi.stubEnv('ADMIN_SESSION_SECRET', SECRET);
  vi.stubEnv('APPS_SCRIPT_TREND_ENDPOINT', 'https://review-sheet.invalid/exec');
  vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
    if (url !== 'https://review-sheet.invalid/exec') throw new Error(`no network in this test: ${url}`);
    forwarded.push(JSON.parse(init.body));
    return new Response('{}', { status: 200 });
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('/api/health/email', () => {
  /** A healthy hourly run and three sign-ups, so every count the old body carried is non-zero. */
  async function healthy(db: Fake) {
    await recordRun(db as unknown as NurtureDB, 7, 2, null);
    for (const who of ['a', 'b', 'c']) await storeBuilderSignup(db as never, { email: `${who}@example.com`, source: 'free-wedding-planner', host: 'weddingchecklistpdf.com', marketing: true });
    db.sql.length = 0;
  }

  it('a stranger gets OK and nothing else, and the request only reads', async () => {
    const db = state.db!; await healthy(db);
    const before = schema(db);
    const res = await emailGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'OK' });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(db.sql.length).toBeGreaterThan(0);
    for (const sql of db.sql) expect(sql).toMatch(/^\s*SELECT\b/i);
    expect(schema(db)).toBe(before);
  });

  it('a stranger gets FAIL with no stop line when the last run stopped, is old, or was never recorded', async () => {
    const db = state.db!;
    // Never recorded: the table is not there, and asking does not create it.
    let res = await emailGET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'FAIL' });
    expect(db.raw.prepare(`SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'nurture_runs'`).get()!.n).toBe(0);
    // A named stop.
    await recordRun(db as unknown as NurtureDB, 0, 4, 'NAMED STOP [RESEND_SEND_FAILED] 4 email(s) not sent (Resend HTTP 401: API key is invalid)');
    res = await emailGET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'FAIL' });
    // An old run (the hourly cron stopped): over 3 hours ago.
    db.raw.exec(`DELETE FROM nurture_runs; INSERT INTO nurture_runs (ran_at, sent, failed, stop) VALUES ('2026-01-01 00:00:00', 9, 0, NULL)`);
    res = await emailGET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'FAIL' });
  });

  it('a forged, expired, wrong-role or secret-less session is a stranger', async () => {
    await healthy(state.db!);
    const cookies = [
      sessionCookie('a-guessed-secret'),
      sessionCookie(SECRET, 'owner', Math.floor(Date.now() / 1000) - 1),
      sessionCookie(SECRET, 'viewer'),
      `${sessionCookie(SECRET).split('.')[0]}.`,
      'owner'
    ];
    for (const cookie of cookies) {
      state.cookie = cookie;
      expect(await (await emailGET()).json(), cookie).toEqual({ status: 'OK' });
    }
    // The secret is not configured: nobody is the owner, whatever cookie they hold.
    vi.stubEnv('ADMIN_SESSION_SECRET', '');
    state.cookie = sessionCookie('');
    expect(await (await emailGET()).json()).toEqual({ status: 'OK' });
  });

  it('the signed-in owner still reads the last run, the stop line and the sign-up counts', async () => {
    const db = state.db!; await healthy(db);
    await createAdminSession();
    let res = await emailGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'OK', reason: 'OK', last_run: { sent: 7, failed: 2 }, signups: { total: 3, marketing: 3 } });
    await recordRun(db as unknown as NurtureDB, 0, 4, 'NAMED STOP [RESEND_SEND_FAILED] 4 email(s) not sent');
    db.raw.exec(`UPDATE nurture_runs SET ran_at = datetime('now', '+1 second') WHERE stop IS NOT NULL`);
    res = await emailGET();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: 'FAIL', reason: 'NAMED STOP [RESEND_SEND_FAILED] 4 email(s) not sent' });
  });

  it('a database that is missing or cannot be read is FAIL 503, never OK', async () => {
    await healthy(state.db!);
    state.db!.broken = true;
    let res = await emailGET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'FAIL' });
    state.db = undefined;
    res = await emailGET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'FAIL' });
    state.envThrows = true;
    res = await emailGET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'FAIL' });
  });
});

describe('/api/health/delivery', () => {
  const paidOrder = (db: Fake, id: string, at: string) => db.raw.prepare(
    `INSERT INTO orders (id, stripe_session_id, sku, product_id, customer_email, payment_status, created_at) VALUES (?, ?, 'sku', 'p', 'buyer@example.com', 'paid', ?)`
  ).run(id, `cs_${id}`, at);
  const attempt = (db: Fake, id: string, status: string) => db.raw.prepare(`INSERT INTO delivery_attempts (order_id, channel, status) VALUES (?, 'email', ?)`).run(id, status);

  it('a stranger gets OK or FAIL and never a count or a date', async () => {
    const db = state.db!;
    let res = await deliveryGET(); // no orders at all
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'OK' });
    paidOrder(db, 'ord-1', '2026-11-20 10:00:00'); attempt(db, 'ord-1', 'SENT');
    res = await deliveryGET(); // one order, delivered
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'OK' });
    paidOrder(db, 'ord-2', '2026-11-21 10:00:00'); attempt(db, 'ord-2', 'FAILED');
    paidOrder(db, 'ord-3', '2026-11-22 10:00:00');
    res = await deliveryGET(); // two paid orders with no SENT email
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'FAIL' });
    expect(res.headers.get('cache-control')).toBe('no-store');
    for (const sql of db.sql) expect(sql).toMatch(/^\s*SELECT\b/i);
    state.cookie = sessionCookie('a-guessed-secret');
    expect(await (await deliveryGET()).json()).toEqual({ status: 'FAIL' });
  });

  it('the signed-in owner still reads how many orders wait and since when', async () => {
    const db = state.db!;
    paidOrder(db, 'ord-2', '2026-11-21 10:00:00'); attempt(db, 'ord-2', 'FAILED');
    paidOrder(db, 'ord-3', '2026-11-22 10:00:00');
    await createAdminSession();
    const res = await deliveryGET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'FAIL', reason: 'UNDELIVERED_ORDERS', undelivered_count: 2, oldest: '2026-11-21 10:00:00' });
    attempt(db, 'ord-2', 'SENT'); attempt(db, 'ord-3', 'SENT');
    expect(await (await deliveryGET()).json()).toEqual({ status: 'OK', reason: 'OK', undelivered_count: 0, oldest: null });
  });

  it('a database that is missing or cannot be read is FAIL 503, never OK', async () => {
    state.db!.broken = true;
    let res = await deliveryGET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'FAIL' });
    state.db = undefined;
    res = await deliveryGET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'FAIL' });
    state.envThrows = true;
    res = await deliveryGET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'FAIL' });
  });
});

describe('/api/submit-trend', () => {
  const idea = (n: number | string, extra: Record<string, unknown> = {}) => ({ idea_name: `Idea ${n}`, description: 'A champagne tower', category: 'Reception', ...extra });
  const post = (body: unknown, headers: Record<string, string>) => trendPOST(new NextRequest('https://weddingchecklistpdf.com/api/submit-trend', {
    method: 'POST', headers: { 'content-type': 'application/json', host: 'weddingchecklistpdf.com', ...headers }, body: JSON.stringify(body)
  }));
  const from = (ip: string) => ({ 'cf-connecting-ip': ip });
  const MAX = LIMITS.trendSubmit.max;

  it('an idea under the limit reaches the review sheet as before', async () => {
    const res = await post(idea(1, { why_cool: 'It sparkles', price_this_out: 'on' }), from('203.0.113.7'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: 'received_for_review' });
    expect(forwarded).toHaveLength(1);
    expect(forwarded[0]).toMatchObject({ idea_name: 'Idea 1', description: 'A champagne tower', category: 'Reception', why_cool: 'It sparkles', price_this_out: true, status: 'new' });
  });

  it('one connection gets the limit and no more; the next idea is refused and never forwarded', async () => {
    for (let i = 0; i < MAX; i++) expect((await post(idea(i), from('203.0.113.7'))).status).toBe(200);
    const over = await post(idea('stuffed'), from('203.0.113.7'));
    expect(over.status).toBe(429);
    expect(over.headers.get('retry-after')).toBe(String(LIMITS.trendSubmit.windowS));
    expect(forwarded).toHaveLength(MAX);
    expect(JSON.stringify(forwarded)).not.toContain('stuffed');
    // The address itself is never stored, only its hash.
    expect(JSON.stringify(state.db!.raw.prepare('SELECT * FROM rate_events').all())).not.toContain('203.0.113.7');
  });

  it('a stranger who uses up their own tries locks out nobody else', async () => {
    for (let i = 0; i < MAX + 20; i++) await post(idea(i), from('203.0.113.7'));
    expect((await post(idea('real'), from('198.51.100.2'))).status).toBe(200);
    expect(forwarded.at(-1)).toMatchObject({ idea_name: 'Idea real' });
  });

  it('a forged x-forwarded-for buys no extra tries: the count follows the address Cloudflare saw', async () => {
    for (let i = 0; i < MAX; i++) expect((await post(idea(i), { ...from('203.0.113.7'), 'x-forwarded-for': `10.0.0.${i}` })).status).toBe(200);
    expect((await post(idea('forged'), { ...from('203.0.113.7'), 'x-forwarded-for': '10.9.9.9' })).status).toBe(429);
    expect(forwarded).toHaveLength(MAX);
  });

  it('the limit also holds when no review endpoint is configured', async () => {
    vi.stubEnv('APPS_SCRIPT_TREND_ENDPOINT', '');
    for (let i = 0; i < MAX; i++) expect((await post(idea(i), from('203.0.113.7'))).status).toBe(200);
    expect((await post(idea('over'), from('203.0.113.7'))).status).toBe(429);
  });

  it('the window rolls: refused one second before the hour is up, accepted on the hour', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const start = Date.parse('2026-11-27T12:00:00Z');
    vi.setSystemTime(start);
    for (let i = 0; i < MAX; i++) expect((await post(idea(i), from('203.0.113.7'))).status).toBe(200);
    vi.setSystemTime(start + (LIMITS.trendSubmit.windowS - 1) * 1000);
    expect((await post(idea('early'), from('203.0.113.7'))).status).toBe(429);
    vi.setSystemTime(start + LIMITS.trendSubmit.windowS * 1000);
    expect((await post(idea('on the hour'), from('203.0.113.7'))).status).toBe(200);
  });

  it('a filled honeypot and an incomplete idea use no try and forward nothing', async () => {
    for (let i = 0; i < MAX + 3; i++) {
      expect((await post(idea(i, { company: 'Acme' }), from('203.0.113.7'))).status).toBe(200);
      expect((await post({ idea_name: 'No description', category: 'Reception' }, from('203.0.113.7'))).status).toBe(400);
    }
    expect(forwarded).toHaveLength(0);
    expect(state.db!.raw.prepare(`SELECT COUNT(*) AS n FROM rate_events WHERE bucket = 'submit-trend'`).get()!.n).toBe(0);
    expect((await post(idea('real'), from('203.0.113.7'))).status).toBe(200);
  });

  it('when the count cannot be kept the idea is refused plainly (503), never forwarded uncounted and never a 500', async () => {
    const refused = async () => {
      const res = await post(idea('outage'), from('203.0.113.7'));
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ ok: false, error: 'Idea submissions are unavailable right now. Please try again shortly.' });
    };
    state.db!.broken = true; await refused();
    state.db = undefined; await refused();
    state.envThrows = true; await refused();
    expect(forwarded).toHaveLength(0);
  });
});
