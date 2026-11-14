// A fully refunded website purchase loses its downloads. Stripe sends charge.refunded to
// /api/stripe-webhook; every order paid by that charge is marked refunded and its
// entitlement REVOKED. The download, dated-plan and fresh-link routes already refuse
// anything that is not ACTIVE / paid, and the hourly delivery retry only looks at paid
// orders, so nothing re-sends or re-opens it. A partial refund keeps access.
// Behaviour test: lib/__tests__/refunds.test.ts.

export type RefundedCharge = { refunded?: boolean; payment_intent?: string | { id: string } | null };
type Db = { prepare(sql: string): { bind(...values: unknown[]): { run(): Promise<unknown> } } };

export async function revokeRefundedCharge(db: Db, charge: RefundedCharge, stripeKey: string, fetchImpl: typeof fetch = fetch) {
  if (!charge?.refunded || !charge.payment_intent) return [] as string[];
  if (!stripeKey) throw new Error('STRIPE_SECRET_KEY is not configured; refund could not revoke downloads');
  const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent.id;
  const res = await fetchImpl(`https://api.stripe.com/v1/checkout/sessions?payment_intent=${encodeURIComponent(pi)}&limit=10`, {
    headers: { Authorization: `Bearer ${stripeKey}` }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Stripe session lookup failed: ${body?.error?.message || res.status}`);
  const sessionIds: string[] = (body?.data || []).map((s: { id: string }) => s.id);
  for (const id of sessionIds) {
    await db.prepare(`UPDATE entitlements SET status='REVOKED', revoked_at=CURRENT_TIMESTAMP
      WHERE order_id IN (SELECT id FROM orders WHERE stripe_session_id=?)`).bind(id).run();
    await db.prepare(`UPDATE orders SET payment_status='refunded', updated_at=CURRENT_TIMESTAMP WHERE stripe_session_id=?`).bind(id).run();
  }
  return sessionIds;
}
