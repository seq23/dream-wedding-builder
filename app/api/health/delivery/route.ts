import { NextResponse } from 'next/server';
import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { requireAdmin } from '@/lib/admin-auth';
import { undeliveredPaidOrders } from '@/lib/delivery-email';

export const dynamic = 'force-dynamic';

const answer = (ok: boolean, detail: Record<string, unknown> = {}) =>
  NextResponse.json({ status: ok ? 'OK' : 'FAIL', ...detail }, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });

// Health check for buyer delivery email. 503 while any paid order has no SENT delivery
// email, or while the orders cannot be read, so an uptime monitor or health board turns
// red instead of the failure sitting silently in D1.
//
// Security audit 23 Nov 2026: a stranger gets OK or FAIL and nothing else (it used to hand
// anyone the number of undelivered paid orders and the date of the oldest). Those are shown
// only to the signed-in owner (the /admin session, lib/admin-auth.ts); /admin lists the orders.
export async function GET() {
  const owner = await requireAdmin().catch(() => false);
  try {
    const env = await runtimeEnv();
    if (!env.DB) return answer(false, owner ? { reason: 'D1 binding DB is unavailable' } : {});
    const undelivered = await undeliveredPaidOrders(env.DB);
    const ok = undelivered.length === 0;
    return answer(ok, owner ? { reason: ok ? 'OK' : 'UNDELIVERED_ORDERS', undelivered_count: undelivered.length, oldest: undelivered[0]?.created_at ?? null } : {});
  } catch {
    return answer(false, owner ? { reason: 'the orders could not be read' } : {});
  }
}
