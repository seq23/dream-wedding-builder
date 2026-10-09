import { NextResponse } from 'next/server';
import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { undeliveredPaidOrders } from '@/lib/delivery-email';

export const dynamic = 'force-dynamic';

// Health check for buyer delivery email. 503 while any paid order has no SENT
// delivery email, so an uptime monitor or health board turns red instead of the
// failure sitting silently in D1. Public, so it returns a count and nothing else.
export async function GET() {
  const env = await runtimeEnv();
  if (!env.DB) return NextResponse.json({ status: 'UNKNOWN', error: 'D1 binding DB is unavailable' }, { status: 503 });
  const undelivered = await undeliveredPaidOrders(env.DB);
  const ok = undelivered.length === 0;
  return NextResponse.json(
    { status: ok ? 'OK' : 'UNDELIVERED_ORDERS', undelivered_count: undelivered.length, oldest: undelivered[0]?.created_at ?? null },
    { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  );
}
