// Hands-off recovery for paid orders whose download email never went out.
//
// Incident, 2026-07-11: Resend rejected the only real order's email (unverified
// domain). Replaying the Stripe event cannot help because stripe_events dedupes on
// event_id, so the order sat undelivered. The Worker's cron trigger (worker.ts,
// wrangler.jsonc "triggers") now calls runDeliveryRetry() hourly: every paid order
// with no SENT delivery attempt is re-sent through sendDeliveryEmail() with a fresh
// 24-hour download token, at most MAX_RETRIES times with backoff. An order that
// exhausts its retries stays on the /admin red panel and keeps
// /api/health/delivery at 503 instead of looping. The /admin "Resend delivery
// email" button calls resendDeliveryEmail() for one order, outside the cap.
//
// The guard that matters: an order with ANY SENT attempt is never sent again. It is
// enforced twice, in the candidate query and again per order right before sending.

import { createDownloadToken } from './fulfillment';
import { productBySku } from './products';
import { sendDeliveryEmail, type DeliveryEnv } from './delivery-email';

export const RETRY_CHANNEL = 'email_retry';
export const MANUAL_CHANNEL = 'email_manual';
export const MAX_RETRIES = 5;
// Minutes to wait after retry n before retry n+1 (index = retries already made).
export const BACKOFF_MINUTES = [0, 60, 180, 720, 1440];
// Leave a just-created order to the webhook that is still sending its first email.
export const MIN_ORDER_AGE_MINUTES = 15;
export const DEFAULT_BASE_URL = 'https://weddingchecklistpdf.com';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export type RetryEnv = DeliveryEnv & { DOWNLOAD_SIGNING_SECRET?: string; APP_BASE_URL?: string };

export type RetryCandidate = {
  order_id: string;
  email: string;
  sku: string;
  entitlement_id: string | null;
  created_at: string;
  retries: number;
  last_retry_at: string | null;
};

export const CANDIDATES_SQL = `SELECT o.id AS order_id, o.customer_email AS email, o.sku AS sku, o.created_at AS created_at,
  (SELECT e.id FROM entitlements e WHERE e.order_id = o.id) AS entitlement_id,
  (SELECT COUNT(*) FROM delivery_attempts r WHERE r.order_id = o.id AND r.channel = '${RETRY_CHANNEL}') AS retries,
  (SELECT MAX(r.attempted_at) FROM delivery_attempts r WHERE r.order_id = o.id AND r.channel = '${RETRY_CHANNEL}') AS last_retry_at
  FROM orders o
  WHERE o.payment_status = 'paid'
    AND NOT EXISTS (SELECT 1 FROM delivery_attempts s WHERE s.order_id = o.id AND s.status = 'SENT')
  ORDER BY o.created_at`;

export const SENT_GUARD_SQL = `SELECT 1 AS sent FROM delivery_attempts WHERE order_id = ? AND status = 'SENT' LIMIT 1`;

// D1 CURRENT_TIMESTAMP is UTC "YYYY-MM-DD HH:MM:SS".
export function parseDbTime(value: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return Number.isNaN(ms) ? null : ms;
}

export type Eligibility = 'DUE' | 'EXHAUSTED' | 'BACKOFF' | 'TOO_NEW';

export function eligibility(c: Pick<RetryCandidate, 'retries' | 'last_retry_at' | 'created_at'>, now: number): Eligibility {
  if (c.retries >= MAX_RETRIES) return 'EXHAUSTED';
  const created = parseDbTime(c.created_at);
  if (created !== null && now - created < MIN_ORDER_AGE_MINUTES * 60_000) return 'TOO_NEW';
  const last = parseDbTime(c.last_retry_at);
  if (c.retries > 0 && last !== null && now - last < BACKOFF_MINUTES[c.retries] * 60_000) return 'BACKOFF';
  return 'DUE';
}

export type SendOutcome = { order_id: string; outcome: 'SENT' | 'FAILED' | 'ALREADY_SENT' | 'NOT_SENDABLE'; message_id: string | null; error: string | null };

async function alreadySent(db: any, orderId: string) {
  return Boolean(await db.prepare(SENT_GUARD_SQL).bind(orderId).first());
}

async function sendOne(env: RetryEnv, c: RetryCandidate, channel: string, now: number, fetchImpl: typeof fetch): Promise<SendOutcome> {
  const base = { order_id: c.order_id, message_id: null };
  if (await alreadySent(env.DB, c.order_id)) return { ...base, outcome: 'ALREADY_SENT', error: null };
  const product = productBySku(c.sku);
  const secret = env.DOWNLOAD_SIGNING_SECRET;
  const problem = !product ? `Unknown SKU: ${c.sku}` : !c.entitlement_id ? 'Order has no entitlement' : !secret ? 'DOWNLOAD_SIGNING_SECRET is not configured' : null;
  if (problem) {
    // Recorded as a FAILED attempt so it counts toward the cap and shows on /admin.
    await env.DB.prepare('INSERT INTO delivery_attempts (order_id, channel, status, provider_message_id, error_message) VALUES (?, ?, ?, ?, ?)')
      .bind(c.order_id, channel, 'FAILED', null, problem).run();
    console.error(JSON.stringify({ event: 'DELIVERY_EMAIL_FAILED', order_id: c.order_id, status: 'NOT_SENDABLE', error: problem }));
    return { ...base, outcome: 'NOT_SENDABLE', error: problem };
  }
  const token = createDownloadToken(c.entitlement_id!, now + TOKEN_TTL_MS, secret!);
  const url = `${(env.APP_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '')}/api/download/${token}`;
  try {
    // sendDeliveryEmail records the attempt row (any outcome) and logs failures.
    const result = await sendDeliveryEmail(env, c.order_id, c.email, product!.name, url, fetchImpl, channel);
    return { order_id: c.order_id, outcome: 'SENT', message_id: result.messageId, error: null };
  } catch (error) {
    return { ...base, outcome: 'FAILED', error: error instanceof Error ? error.message : String(error) };
  }
}

export type RetryRun = { examined: number; attempted: number; sent: number; failed: number; exhausted: number; waiting: number; results: SendOutcome[] };

export async function runDeliveryRetry(env: RetryEnv, now = Date.now(), fetchImpl: typeof fetch = fetch): Promise<RetryRun> {
  if (!env.DB) throw new Error('D1 binding DB is unavailable');
  const rows: RetryCandidate[] = ((await env.DB.prepare(CANDIDATES_SQL).all())?.results || []).map((r: any) => ({
    ...r, retries: Number(r.retries || 0)
  }));
  const run: RetryRun = { examined: rows.length, attempted: 0, sent: 0, failed: 0, exhausted: 0, waiting: 0, results: [] };
  for (const c of rows) {
    const state = eligibility(c, now);
    if (state === 'EXHAUSTED') { run.exhausted++; continue; }
    if (state !== 'DUE') { run.waiting++; continue; }
    const result = await sendOne(env, c, RETRY_CHANNEL, now, fetchImpl);
    run.results.push(result);
    if (result.outcome === 'SENT') { run.attempted++; run.sent++; }
    else if (result.outcome === 'FAILED') { run.attempted++; run.failed++; }
    else if (result.outcome === 'NOT_SENDABLE') { run.attempted++; run.failed++; }
  }
  return run;
}

// The /admin button: one order, now, regardless of cap or backoff. Still refuses an
// order that already has a SENT attempt.
export async function resendDeliveryEmail(env: RetryEnv, orderId: string, now = Date.now(), fetchImpl: typeof fetch = fetch): Promise<SendOutcome> {
  if (!env.DB) throw new Error('D1 binding DB is unavailable');
  const row = await env.DB.prepare(`SELECT o.id AS order_id, o.customer_email AS email, o.sku AS sku, o.created_at AS created_at,
    (SELECT e.id FROM entitlements e WHERE e.order_id = o.id) AS entitlement_id
    FROM orders o WHERE o.id = ? AND o.payment_status = 'paid'`).bind(orderId).first();
  if (!row) return { order_id: orderId, outcome: 'NOT_SENDABLE', message_id: null, error: 'No paid order with that id' };
  return sendOne(env, { ...row, retries: 0, last_retry_at: null }, MANUAL_CHANNEL, now, fetchImpl);
}
