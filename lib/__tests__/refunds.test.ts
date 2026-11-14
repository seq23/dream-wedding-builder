import { describe, expect, it } from 'vitest';
import { revokeRefundedCharge } from '@/lib/refunds';

// A tiny stand-in for D1 holding one order and its entitlement, applying the two UPDATEs.
function fakeDb() {
  const order = { id: 'ord_1', stripe_session_id: 'cs_test_paid', payment_status: 'paid' };
  const entitlement = { order_id: 'ord_1', status: 'ACTIVE', revoked_at: null as string | null };
  const db = {
    prepare(sql: string) {
      return {
        bind(sessionId: string) {
          return {
            async run() {
              if (sessionId !== order.stripe_session_id) return;
              if (/UPDATE entitlements SET status='REVOKED'/.test(sql)) { entitlement.status = 'REVOKED'; entitlement.revoked_at = 'now'; }
              if (/UPDATE orders SET payment_status='refunded'/.test(sql)) order.payment_status = 'refunded';
            }
          };
        }
      };
    }
  };
  return { db, order, entitlement };
}

const stripeLists = (sessionId: string) => (async (url: string) => {
  expect(String(url)).toContain('payment_intent=pi_1');
  return new Response(JSON.stringify({ data: [{ id: sessionId }] }), { status: 200 });
}) as unknown as typeof fetch;

describe('refunds close the downloads', () => {
  it('a full refund revokes the entitlement and marks the order refunded', async () => {
    const { db, order, entitlement } = fakeDb();
    const revoked = await revokeRefundedCharge(db, { refunded: true, payment_intent: 'pi_1' }, 'sk_test_x', stripeLists('cs_test_paid'));
    expect(revoked).toEqual(['cs_test_paid']);
    expect(entitlement.status).toBe('REVOKED');
    expect(order.payment_status).toBe('refunded');
  });

  it('a partial refund keeps access', async () => {
    const { db, order, entitlement } = fakeDb();
    const revoked = await revokeRefundedCharge(db, { refunded: false, payment_intent: 'pi_1' }, 'sk_test_x', stripeLists('cs_test_paid'));
    expect(revoked).toEqual([]);
    expect(entitlement.status).toBe('ACTIVE');
    expect(order.payment_status).toBe('paid');
  });

  it('a failed Stripe lookup throws so Stripe retries the event', async () => {
    const { db } = fakeDb();
    const failing = (async () => new Response(JSON.stringify({ error: { message: 'down' } }), { status: 500 })) as unknown as typeof fetch;
    await expect(revokeRefundedCharge(db, { refunded: true, payment_intent: 'pi_1' }, 'sk_test_x', failing)).rejects.toThrow(/lookup failed/);
  });
});
