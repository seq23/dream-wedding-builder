import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { NextRequest } from 'next/server';

// Test purchase, 11 Nov 2026: the links in the order email died after 24 hours and the
// only way back was a success page nobody keeps. A buyer now gets back to what she paid
// for with the email she bought with. The real routes and the real SQL run here against
// SQLite with the real migration; Resend is a fake fetch, so no email leaves.

const state: { env: Record<string, unknown> } = { env: {} };
vi.mock('@/lib/cloudflare-runtime', () => ({ runtimeEnv: async () => state.env }));

import { POST as freshLink } from '@/app/api/fresh-link/route';
import { GET as getPlan } from '@/app/api/full-plan/[token]/route';
import { GET as getDownload } from '@/app/api/download/[token]/route';
import { createDownloadToken, verifyDownloadToken } from '@/lib/fulfillment';
import { FRESH_LINK_ANSWER, FRESH_LINK_CHANNEL } from '@/lib/fresh-link';
import { FULL_PLAN_KEY } from '@/lib/full-plan';
import { LIMITS } from '@/lib/abuse-limits';
import { productById } from '@/lib/products';

const SQL = await initSqlJs();
const SECRET = 'test-signing-secret';
const SKU = productById('checklist-pdf')!.sku;
const BUYER = 'bride@example.com';
const DAY = 24 * 60 * 60 * 1000;
const LIST = JSON.stringify({ windows: [{ id: 'w', label: 'Wedding week' }], tasks: [{ id: 't1', window: 'w', text: 'Pay the florist', daysBefore: 7, owner: '', kind: 'payment' }] });

// D1-shaped adapter over sql.js (same shape as tests/unit/delivery-retry.test.ts).
function d1(db: any) {
  const exec = (sql: string, args: any[]) => { const stmt = db.prepare(sql); stmt.bind(args); const rows: any[] = []; while (stmt.step()) rows.push(stmt.getAsObject()); stmt.free(); return rows; };
  const make = (sql: string, args: any[] = []) => ({
    bind: (...a: any[]) => make(sql, a),
    all: async () => ({ results: exec(sql, args) }),
    first: async () => exec(sql, args)[0] ?? null,
    run: async () => { exec(sql, args); return { meta: { changes: db.getRowsModified() } }; }
  });
  return { prepare: (sql: string) => make(sql) };
}

let raw: any; let sends: any[];
function purchase(id: string, email: string, status = 'ACTIVE') {
  raw.run(`INSERT INTO orders (id, stripe_session_id, sku, product_id, customer_email, payment_status) VALUES (?, ?, ?, 'checklist-pdf', ?, 'paid')`, [id, `cs_${id}`, SKU, email]);
  raw.run(`INSERT INTO entitlements (id, order_id, sku, product_id, customer_email, release_key, status) VALUES (?, ?, ?, 'checklist-pdf', ?, 'k', ?)`, [`ent-${id}`, id, SKU, email, status]);
}
const ask = (email: unknown, ip = '203.0.113.1') => freshLink(new NextRequest('https://weddingchecklistpdf.com/api/fresh-link', {
  method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip }, body: JSON.stringify({ email })
}));
const plan = (token: string) => getPlan(new NextRequest('https://weddingchecklistpdf.com/api/full-plan/x'), { params: Promise.resolve({ token }) });
const download = (token: string) => getDownload(new NextRequest('https://weddingchecklistpdf.com/api/download/x'), { params: Promise.resolve({ token }) });

beforeEach(() => {
  raw = new SQL.Database();
  raw.exec(readFileSync('migrations/0001_fulfillment.sql', 'utf8').replace('PRAGMA foreign_keys = ON;', ''));
  sends = [];
  state.env = {
    DB: d1(raw), RESEND_API_KEY: 'k', DOWNLOAD_SIGNING_SECRET: SECRET, APP_BASE_URL: 'https://weddingchecklistpdf.com',
    PRODUCT_RELEASES: { get: async (key: string) => (key === FULL_PLAN_KEY ? { text: async () => LIST } : null) }
  };
  vi.stubGlobal('fetch', async (url: string, init: any) => {
    if (!String(url).startsWith('https://api.resend.com/')) throw new Error(`unexpected fetch: ${url}`);
    sends.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: `msg_${sends.length}` }), { status: 200 });
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('a buyer can always get back to what she paid for', () => {
  it('a timed-out link is told apart from a forged one, and her email brings one order email with links that work', async () => {
    purchase('o1', BUYER);
    const old = createDownloadToken('ent-o1', Date.now() - 1000, SECRET);

    // The timed-out link: the plan page is told so (it then shows the form), and the download goes to the form page.
    const expiredPlan = await plan(old);
    expect(expiredPlan.status).toBe(401);
    expect(await expiredPlan.json()).toMatchObject({ ok: false, expired: true });
    const expiredDownload = await download(old);
    expect(expiredDownload.status).toBe(303);
    expect(expiredDownload.headers.get('location')).toBe('https://weddingchecklistpdf.com/order/link?expired=1');

    // She types the email she bought with (any capitals): one order email, to her, with fresh links.
    const res = await ask('  Bride@Example.com ');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, message: FRESH_LINK_ANSWER });
    expect(sends).toHaveLength(1);
    expect(sends[0].to).toEqual([BUYER]);
    const token = sends[0].html.match(/\/full-plan\?t=([A-Za-z0-9_-]+)/)[1];
    expect(sends[0].html).toContain(`https://weddingchecklistpdf.com/api/download/${token}`);
    // The email tells her how to do this again later.
    expect(sends[0].html).toContain('https://weddingchecklistpdf.com/order/link');

    // The fresh link opens her plan now and on day 6, and has run out by day 8.
    const opened = await plan(token);
    expect(opened.status).toBe(200);
    expect(await opened.json()).toMatchObject({ ok: true, tasks: [{ id: 't1' }] });
    expect(verifyDownloadToken(token, SECRET, Date.now() + 6 * DAY)).toMatchObject({ entitlementId: 'ent-o1' });
    expect(verifyDownloadToken(token, SECRET, Date.now() + 8 * DAY)).toBeNull();
    const rows = d1(raw).prepare('SELECT channel, status FROM delivery_attempts WHERE order_id = ?').bind('o1');
    expect((await rows.all()).results).toEqual([{ channel: FRESH_LINK_CHANNEL, status: 'SENT' }]);
  });

  it('an unknown email, and a refunded purchase, get the same answer and no email', async () => {
    purchase('o1', BUYER);
    purchase('o2', 'refunded@example.com', 'REVOKED');
    const known = await ask(BUYER);
    const unknown = await ask('nobody@example.com');
    const revoked = await ask('refunded@example.com');
    const bodies = [await known.json(), await unknown.json(), await revoked.json()];
    expect([known.status, unknown.status, revoked.status]).toEqual([200, 200, 200]);
    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[2]).toEqual(bodies[0]);
    // The answer never repeats the address back.
    expect(JSON.stringify(bodies)).not.toMatch(/bride@|nobody@|refunded@/);
    expect(sends.map(s => s.to[0])).toEqual([BUYER]);
    // The limiter stores hashes, never an address.
    const keys = (await d1(raw).prepare('SELECT key FROM rate_events').all()).results.map((r: any) => r.key);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('a forged or broken link gets 401 and is never offered a fresh one', async () => {
    purchase('o1', BUYER);
    const forgedLive = createDownloadToken('ent-o1', Date.now() + DAY, 'not-our-secret');
    const forgedOld = createDownloadToken('ent-o1', Date.now() - 1000, 'not-our-secret');
    for (const token of [forgedLive, forgedOld, 'garbage']) {
      const p = await plan(token);
      expect(p.status).toBe(401);
      expect((await p.json()).expired).toBeUndefined();
      const d = await download(token);
      expect(d.status).toBe(401);
      expect(d.headers.get('location')).toBeNull();
    }
    expect(sends).toHaveLength(0);
  });

  it('the 6th ask in an hour from one caller is refused, and one address is emailed at most 3 times a day', async () => {
    purchase('o1', BUYER);
    for (let i = 0; i < LIMITS.freshLink.max; i++) expect((await ask(`someone${i}@example.com`)).status).toBe(200);
    const sixth = await ask(BUYER);
    expect(sixth.status).toBe(429);
    expect(sends).toHaveLength(0);
    // Different callers, same buyer: 3 emails, then the same answer with nothing sent.
    for (let i = 0; i < 5; i++) {
      const res = await ask(BUYER, `198.51.100.${i}`);
      expect(await res.json()).toEqual({ ok: true, message: FRESH_LINK_ANSWER });
    }
    expect(sends).toHaveLength(LIMITS.freshLinkEmail.max);
  });
});
