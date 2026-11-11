import { NextRequest, NextResponse } from 'next/server';
import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { createDownloadToken } from '@/lib/fulfillment';
import { productBySku } from '@/lib/products';
import { FULL_PLAN_PRODUCT_IDS, loadFullPlan } from '@/lib/full-plan';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id') || '';
  if (!sessionId.startsWith('cs_')) return NextResponse.json({ status: 'ERROR', message: 'We could not find this order. Your order email has your links.' }, { status: 400 });
  const stripeKey = process.env.STRIPE_SECRET_KEY || '';
  if (!stripeKey) return NextResponse.json({ status: 'ERROR', message: 'We could not check this order just now. Your order email has your links.' }, { status: 503 });
  const stripeResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, { headers: { Authorization: `Bearer ${stripeKey}` }, cache: 'no-store' });
  const stripeSession = await stripeResponse.json();
  if (!stripeResponse.ok || stripeSession.payment_status !== 'paid') return NextResponse.json({ status: 'PENDING', message: 'We are still confirming your payment. This usually takes a few seconds.' }, { status: 202 });

  const env = await runtimeEnv();
  if (!env.DB) return NextResponse.json({ status: 'ERROR', message: 'We could not check this order just now. Your order email has your links.' }, { status: 503 });
  const row = await (env.DB.prepare(`SELECT o.id order_id, o.sku, o.customer_email, o.status order_status,
    e.id entitlement_id, e.status entitlement_status, e.release_key
    FROM orders o LEFT JOIN entitlements e ON e.order_id=o.id WHERE o.stripe_session_id=?`).bind(sessionId).first() as Promise<any>);
  if (!row?.entitlement_id) return NextResponse.json({ status: 'PROCESSING', message: 'Your payment went through. We are getting your files ready.' }, { status: 202 });
  const signingSecret = process.env.DOWNLOAD_SIGNING_SECRET || env.DOWNLOAD_SIGNING_SECRET;
  if (!signingSecret) return NextResponse.json({ status: 'ERROR', message: 'We could not check this order just now. Your order email has your links.' }, { status: 503 });
  const token = createDownloadToken(row.entitlement_id, Date.now() + 60 * 60 * 1000, signingSecret);
  const product = productBySku(row.sku);
  const asset = env.PRODUCT_RELEASES ? await env.PRODUCT_RELEASES.head(row.release_key) : null;
  // Checklist and suite buyers also get their plan dated from their wedding date. If the
  // task list cannot be read they still get the files, and loadFullPlan logs the named stop.
  const planReady = Boolean(product && FULL_PLAN_PRODUCT_IDS.includes(product.id) && (await loadFullPlan(env.PRODUCT_RELEASES as never, 'api/order-status')));
  return NextResponse.json({
    status: asset ? 'READY' : 'AWAITING_ASSET',
    product_name: product?.name || row.sku,
    email: row.customer_email.replace(/^(.{2}).+(@.+)$/, '$1•••$2'),
    download_url: asset ? `/api/download/${token}` : null,
    plan_url: planReady ? `/full-plan?t=${token}` : null,
    message: asset ? 'Your purchase is ready.' : 'Your payment went through. Your files are not ready to download yet.'
  });
}
