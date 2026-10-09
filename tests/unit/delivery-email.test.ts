import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { sendDeliveryEmail, undeliveredPaidOrders, DEFAULT_FROM } from '@/lib/delivery-email';

// Incident 2026-07-11: Resend rejected the only real order's email ("domain is not
// verified") and the failure sat unread in D1. These pin that every non-SENT outcome
// is recorded, logged as DELIVERY_EMAIL_FAILED, thrown (so Stripe retries) and counted.

function fakeDb(rows: any[] = []) {
  const writes: any[][] = [];
  return {
    writes,
    prepare: (sql: string) => ({
      bind: (...args: any[]) => ({ run: async () => { writes.push([sql, ...args]); return { meta: { changes: 1 } }; } }),
      all: async () => ({ results: rows })
    })
  };
}
const json = (status: number, body: any) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

afterEach(() => vi.restoreAllMocks());

describe('delivery email', () => {
  it('records FAILED, logs DELIVERY_EMAIL_FAILED with domain only, and throws when Resend rejects', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = fakeDb();
    await expect(sendDeliveryEmail({ DB: db, RESEND_API_KEY: 'k' }, 'ord-1', 'buyer@gmail.com', 'Checklist', 'https://x/d', json(403, { message: 'The weddingchecklistpdf.com domain is not verified.' })))
      .rejects.toThrow(/not verified/);
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0].slice(1)).toEqual(['ord-1', 'email', 'FAILED', null, 'The weddingchecklistpdf.com domain is not verified.']);
    expect(log).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(log.mock.calls[0][0]));
    expect(line).toMatchObject({ event: 'DELIVERY_EMAIL_FAILED', order_id: 'ord-1', status: 'FAILED', email_domain: '@gmail.com' });
    expect(String(log.mock.calls[0][0])).not.toContain('buyer@');
  });

  it('treats a missing key as a failure: PENDING_PROVIDER recorded, logged and thrown', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = fakeDb();
    await expect(sendDeliveryEmail({ DB: db }, 'ord-2', 'a@b.co', 'Checklist', 'https://x/d')).rejects.toThrow(/RESEND_API_KEY/);
    expect(db.writes[0][3]).toBe('PENDING_PROVIDER');
    expect(JSON.parse(String(log.mock.calls[0][0])).event).toBe('DELIVERY_EMAIL_FAILED');
  });

  it('records a network error as FAILED and throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = fakeDb();
    const boom = (async () => { throw new Error('ECONNRESET'); }) as unknown as typeof fetch;
    await expect(sendDeliveryEmail({ DB: db, RESEND_API_KEY: 'k' }, 'ord-3', 'a@b.co', 'Checklist', 'https://x/d', boom)).rejects.toThrow(/ECONNRESET/);
    expect(db.writes[0][3]).toBe('FAILED');
  });

  it('records SENT with the provider id, logs nothing, and sends from the verified subdomain by default', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = fakeDb();
    let body: any;
    const ok = (async (_u: string, init: any) => { body = JSON.parse(init.body); return new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 }); }) as unknown as typeof fetch;
    const result = await sendDeliveryEmail({ DB: db, RESEND_API_KEY: 'k' }, 'ord-4', 'a@b.co', 'Checklist', 'https://x/d', ok);
    expect(result).toEqual({ status: 'SENT', messageId: 'msg_1', error: null });
    expect(db.writes[0].slice(1)).toEqual(['ord-4', 'email', 'SENT', 'msg_1', null]);
    expect(log).not.toHaveBeenCalled();
    expect(body.from).toBe(DEFAULT_FROM);
    expect(DEFAULT_FROM).toMatch(/@mail\.weddingchecklistpdf\.com>$/);
    expect(body.to).toEqual(['a@b.co']);
    expect(body.html).toContain('https://x/d');
  });

  it('reports undelivered paid orders by id and email domain only', async () => {
    const rows = await undeliveredPaidOrders(fakeDb([{ order_id: 'ord-5', email: 'buyer@gmail.com', created_at: '2026-07-11', last_error: 'not verified' }]));
    expect(rows).toEqual([{ order_id: 'ord-5', email_domain: '@gmail.com', created_at: '2026-07-11', last_error: 'not verified', retries: 0 }]);
    expect(JSON.stringify(rows)).not.toContain('buyer');
  });

  it('is the only delivery code path: the webhook imports it and keeps no copy', () => {
    const webhook = readFileSync('app/api/stripe-webhook/route.ts', 'utf8');
    expect(webhook).toMatch(/from '@\/lib\/delivery-email'/);
    expect(webhook).not.toContain('api.resend.com');
  });
});
