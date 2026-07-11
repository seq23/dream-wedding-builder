import { NextRequest, NextResponse } from 'next/server';
import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { createDownloadToken } from '@/lib/fulfillment';
import { productBySku } from '@/lib/products';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id') || '';
  if (!sessionId.startsWith('cs_')) return NextResponse.json({ error: 'Invalid session reference' }, { status: 400 });
  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  if (!stripeKey) return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 });
  const stripeResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, { headers: { Authorization: `Bearer ${stripeKey}` }, cache: 'no-store' });
  const stripeSession = await stripeResponse.json();
  if (!stripeResponse.ok || stripeSession.payment_status !== 'paid') return NextResponse.json({ status: 'PENDING', message: 'Payment verification is still pending.' }, { status: 202 });

  const env = await runtimeEnv();
  if (!env.DB) return NextResponse.json({ error: 'D1 binding DB is unavailable' }, { status: 503 });
  const row = await (env.DB.prepare(`SELECT o.id order_id, o.sku, o.customer_email, o.status order_status,
    e.id entitlement_id, e.status entitlement_status, e.release_key
    FROM orders o LEFT JOIN entitlements e ON e.order_id=o.id WHERE o.stripe_session_id=?`).bind(sessionId).first() as Promise<any>);
  if (!row?.entitlement_id) return NextResponse.json({ status: 'PROCESSING', message: 'Payment is verified. Secure access is still being prepared.' }, { status: 202 });
  const signingSecret = process.env.DOWNLOAD_SIGNING_SECRET || env.DOWNLOAD_SIGNING_SECRET;
  if (!signingSecret) return NextResponse.json({ error: 'Download signing is unavailable' }, { status: 503 });
  const token = createDownloadToken(row.entitlement_id, Date.now() + 60 * 60 * 1000, signingSecret);
  const product = productBySku(row.sku);
  const asset = env.PRODUCT_RELEASES ? await env.PRODUCT_RELEASES.head(row.release_key) : null;
  return NextResponse.json({
    status: asset ? 'READY' : 'AWAITING_ASSET',
    product_name: product?.name || row.sku,
    email: row.customer_email.replace(/^(.{2}).+(@.+)$/, '$1•••$2'),
    download_url: asset ? `/api/download/${token}` : null,
    message: asset ? 'Your secure download is ready.' : 'Your payment is verified. The product release has not yet been uploaded.'
  });
}
