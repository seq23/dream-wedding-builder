import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { resendDeliveryEmail } from '@/lib/delivery-retry';

export const dynamic = 'force-dynamic';

// The /admin "Resend delivery email" button. Owner only; one order; refuses an order
// that already has a SENT attempt. Redirects back to /admin with the outcome.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const env = await runtimeEnv();
  const result = await resendDeliveryEmail(env, id);
  const back = new URL('/admin', req.url);
  back.searchParams.set('resend', result.outcome);
  back.searchParams.set('order', id);
  return NextResponse.redirect(back, 303);
}
