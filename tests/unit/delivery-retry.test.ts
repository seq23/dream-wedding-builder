import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import initSqlJs from 'sql.js';
import {
  runDeliveryRetry, resendDeliveryEmail, eligibility, MAX_RETRIES, BACKOFF_MINUTES, RETRY_CHANNEL, MANUAL_CHANNEL
} from '@/lib/delivery-retry';
import { undeliveredPaidOrders } from '@/lib/delivery-email';
import { verifyDownloadToken } from '@/lib/fulfillment';

// Incident 2026-07-11: a paid order's email failed and replaying the Stripe event
// could not help. The hourly retry re-sends to undelivered paid orders only. These
// run the REAL queries against SQLite with the real migration, so removing the
// "no SENT attempt" guard, the paid filter or the cap makes a test fail.

const SQL = await initSqlJs();
const SKU = 'DWB-CHECKLIST-001';
const SECRET = 'test-signing-secret';
const NOW = Date.parse('2026-10-09T12:00:00Z');
const ts = (msAgo: number) => new Date(NOW - msAgo).toISOString().replace('T', ' ').slice(0, 19);
const MIN = 60_000;

// D1-shaped adapter over sql.js.
function d1(db: any) {
  const exec = (sql: string, args: any[]) => {
    const stmt = db.prepare(sql); stmt.bind(args);
    const rows: any[] = []; while (stmt.step()) rows.push(stmt.getAsObject()); stmt.free();
    return rows;
  };
  const make = (sql: string, args: any[] = []) => ({
    bind: (...a: any[]) => make(sql, a),
    all: async () => ({ results: exec(sql, args) }),
    first: async () => exec(sql, args)[0] ?? null,
    run: async () => { exec(sql, args); return { meta: { changes: db.getRowsModified() } }; }
  });
  return { prepare: (sql: string) => make(sql) };
}

let raw: any; let DB: any; let sends: any[];
const resendOk = (async (_u: string, init: any) => { sends.push(JSON.parse(init.body)); return new Response(JSON.stringify({ id: `msg_${sends.length}` }), { status: 200 }); }) as unknown as typeof fetch;
const resendBad = (async (_u: string, init: any) => { sends.push(JSON.parse(init.body)); return new Response(JSON.stringify({ message: 'Invalid `to` field' }), { status: 422 }); }) as unknown as typeof fetch;
const env = () => ({ DB, RESEND_API_KEY: 'k', DOWNLOAD_SIGNING_SECRET: SECRET, APP_BASE_URL: 'https://weddingchecklistpdf.com' });

function order(id: string, opts: { paid?: boolean; createdAgo?: number; attempts?: [string, string, number?][] } = {}) {
  raw.run(`INSERT INTO orders (id, stripe_session_id, sku, product_id, customer_email, payment_status, created_at) VALUES (?, ?, ?, 'p', ?, ?, ?)`,
    [id, `cs_${id}`, SKU, `${id}@example.com`, opts.paid === false ? 'unpaid' : 'paid', ts(opts.createdAgo ?? 90 * 24 * 60 * MIN)]);
  raw.run(`INSERT INTO entitlements (id, order_id, sku, product_id, customer_email, release_key) VALUES (?, ?, ?, 'p', ?, 'k')`, [`ent-${id}`, id, SKU, `${id}@example.com`]);
  for (const [channel, status, ago] of opts.attempts || []) {
    raw.run(`INSERT INTO delivery_attempts (order_id, channel, status, attempted_at) VALUES (?, ?, ?, ?)`, [id, channel, status, ts(ago ?? 30 * 24 * 60 * MIN)]);
  }
}
const attempts = (id: string) => d1(raw).prepare('SELECT channel, status, provider_message_id FROM delivery_attempts WHERE order_id = ? ORDER BY id').bind(id).all().then((r) => r.results);

beforeEach(() => {
  raw = new SQL.Database();
  raw.exec(readFileSync('migrations/0001_fulfillment.sql', 'utf8').replace('PRAGMA foreign_keys = ON;', ''));
  DB = d1(raw); sends = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('delivery retry', () => {
  it('re-sends only undelivered paid orders, with a fresh valid download token, and records a SENT retry', async () => {
    order('stuck', { attempts: [['email', 'FAILED']] });
    order('delivered', { attempts: [['email', 'SENT']] });
    order('unpaid', { paid: false, attempts: [['email', 'FAILED']] });
    const run = await runDeliveryRetry(env(), NOW, resendOk);
    expect(run).toMatchObject({ examined: 1, attempted: 1, sent: 1, failed: 0 });
    expect(sends.map((s) => s.to[0])).toEqual(['stuck@example.com']);
    expect(await attempts('stuck')).toEqual([
      { channel: 'email', status: 'FAILED', provider_message_id: null },
      { channel: RETRY_CHANNEL, status: 'SENT', provider_message_id: 'msg_1' }
    ]);
    const token = sends[0].html.match(/\/api\/download\/([A-Za-z0-9_-]+)/)[1];
    expect(verifyDownloadToken(token, SECRET, NOW)).toMatchObject({ entitlementId: 'ent-stuck' });
    expect(verifyDownloadToken(token, SECRET, NOW + 25 * 60 * MIN)).toBeNull();
    expect(await undeliveredPaidOrders(DB)).toEqual([]);
  });

  it('never double-sends: a SENT order is skipped on the next run, even when its latest row is a failure', async () => {
    order('stuck', { attempts: [['email', 'FAILED']] });
    order('sent-then-failed', { attempts: [['email', 'SENT'], [MANUAL_CHANNEL, 'FAILED']] });
    await runDeliveryRetry(env(), NOW, resendOk);
    const second = await runDeliveryRetry(env(), NOW + 120 * MIN, resendOk);
    expect(second).toMatchObject({ examined: 0, attempted: 0 });
    expect(sends).toHaveLength(1);
    expect((await attempts('sent-then-failed')).length).toBe(2);
  });

  it('the per-order guard refuses a SENT order even if the candidate list is stale', async () => {
    order('raced', { attempts: [['email', 'SENT']] });
    const outcome = await resendDeliveryEmail(env(), 'raced', NOW, resendOk);
    expect(outcome.outcome).toBe('ALREADY_SENT');
    expect(sends).toHaveLength(0);
  });

  it('caps retries at MAX_RETRIES with backoff, then leaves the order on the admin panel', async () => {
    order('bad-address', { attempts: [['email', 'FAILED']] });
    const at = (ms: number) => new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
    let t = NOW;
    for (let i = 0; i < MAX_RETRIES; i++) {
      expect(await runDeliveryRetry(env(), t, resendBad)).toMatchObject({ attempted: 1, failed: 1 });
      // CURRENT_TIMESTAMP is the wall clock; pin the new row to the simulated clock.
      raw.run('UPDATE delivery_attempts SET attempted_at = ? WHERE id = (SELECT MAX(id) FROM delivery_attempts)', [at(t)]);
      if (i + 1 < MAX_RETRIES) {
        // Inside the backoff window nothing is sent.
        expect(await runDeliveryRetry(env(), t + BACKOFF_MINUTES[i + 1] * MIN - 1000, resendBad)).toMatchObject({ attempted: 0, waiting: 1 });
        t += BACKOFF_MINUTES[i + 1] * MIN + 1000;
      }
    }
    expect(sends).toHaveLength(MAX_RETRIES);
    const after = await runDeliveryRetry(env(), t + 365 * 24 * 60 * MIN, resendBad);
    expect(after).toMatchObject({ attempted: 0, exhausted: 1 });
    expect(sends).toHaveLength(MAX_RETRIES);
    expect(await undeliveredPaidOrders(DB)).toEqual([expect.objectContaining({ order_id: 'bad-address', retries: MAX_RETRIES, last_error: 'Invalid `to` field' })]);
  });

  it('leaves a just-created order to the webhook', async () => {
    order('fresh', { createdAgo: 2 * MIN });
    expect(await runDeliveryRetry(env(), NOW, resendOk)).toMatchObject({ attempted: 0, waiting: 1 });
    expect(sends).toHaveLength(0);
  });

  it('the manual button sends one order outside the cap and records it as manual', async () => {
    order('exhausted', { attempts: Array.from({ length: MAX_RETRIES }, () => [RETRY_CHANNEL, 'FAILED'] as [string, string]) });
    expect(await runDeliveryRetry(env(), NOW, resendOk)).toMatchObject({ attempted: 0, exhausted: 1 });
    const outcome = await resendDeliveryEmail(env(), 'exhausted', NOW, resendOk);
    expect(outcome).toMatchObject({ outcome: 'SENT', message_id: 'msg_1' });
    expect((await attempts('exhausted')).at(-1)).toEqual({ channel: MANUAL_CHANNEL, status: 'SENT', provider_message_id: 'msg_1' });
    expect(await resendDeliveryEmail(env(), 'nope', NOW, resendOk)).toMatchObject({ outcome: 'NOT_SENDABLE' });
  });

  it('eligibility: exhausted at the cap, backoff between retries', () => {
    const created = ts(30 * 24 * 60 * MIN);
    expect(eligibility({ retries: 0, last_retry_at: null, created_at: created }, NOW)).toBe('DUE');
    expect(eligibility({ retries: 1, last_retry_at: ts(BACKOFF_MINUTES[1] * MIN - MIN), created_at: created }, NOW)).toBe('BACKOFF');
    expect(eligibility({ retries: 1, last_retry_at: ts(BACKOFF_MINUTES[1] * MIN + MIN), created_at: created }, NOW)).toBe('DUE');
    expect(eligibility({ retries: MAX_RETRIES, last_retry_at: null, created_at: created }, NOW)).toBe('EXHAUSTED');
  });

  it('is wired: wrangler has an hourly cron and the worker entry runs the retry', () => {
    const wrangler = JSON.parse(readFileSync('wrangler.jsonc', 'utf8').replace(/^\s*\/\/.*$/gm, ''));
    expect(wrangler.main).toBe('worker.ts');
    expect(wrangler.triggers.crons).toEqual(['0 * * * *']);
    const worker = readFileSync('worker.ts', 'utf8');
    expect(worker).toMatch(/async scheduled\(/);
    expect(worker).toMatch(/runDeliveryRetry\(env\)/);
  });
});
