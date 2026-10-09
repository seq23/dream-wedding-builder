import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { createDownloadToken, releaseKeyForSku, safeEmail, verifyStripeSignature, type StripeSession } from '@/lib/fulfillment';
import { productBySku } from '@/lib/products';
import { sendDeliveryEmail } from '@/lib/delivery-email';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get('stripe-signature') || '';
  const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (!secret || !verifyStripeSignature(raw, signature, secret)) return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });

  const event = JSON.parse(raw);
  if (event.type !== 'checkout.session.completed') return NextResponse.json({ received: true, ignored: true });

  const env = await runtimeEnv();
  if (!env.DB) return NextResponse.json({ error: 'D1 binding DB is unavailable' }, { status: 503 });
  const inserted = await env.DB.prepare('INSERT INTO stripe_events (event_id, event_type) VALUES (?, ?) ON CONFLICT(event_id) DO NOTHING')
    .bind(event.id, event.type).run();
  if (!inserted.meta.changes) {
    // Only treat a repeated event as a no-op when the first attempt actually ran to
    // completion. An attempt that failed part-way through fulfilment (most likely a
    // transient email-provider outage) leaves processed_at NULL, and Stripe's retry
    // is the only remaining chance to deliver the purchase. Short-circuiting those
    // retries strands a paying customer with no download email. Every write below is
    // idempotent, so re-running an unfinished event is safe.
    const prior = await (env.DB.prepare('SELECT processed_at FROM stripe_events WHERE event_id = ?')
      .bind(event.id).first() as Promise<{ processed_at: string | null } | null>);
    if (prior?.processed_at) return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    const session = event.data.object as StripeSession;
    if (session.payment_status !== 'paid') throw new Error(`Session is not paid: ${session.payment_status || 'unknown'}`);
    const sku = session.metadata?.sku || '';
    const product = productBySku(sku);
    const email = safeEmail(session.customer_details?.email || session.customer_email);
    if (!product) throw new Error(`Unknown SKU: ${sku}`);
    if (!email) throw new Error('Checkout session has no valid customer email');

    // Reuse the existing order id when this session has already been written. The
    // orders upsert keeps the original primary key on conflict, so minting a fresh
    // id here would point the entitlement insert at a row that does not exist and
    // trip the entitlements -> orders foreign key on every retry.
    const existingOrder = await (env.DB.prepare('SELECT id FROM orders WHERE stripe_session_id = ?')
      .bind(session.id).first() as Promise<{ id: string } | null>);
    const orderId = existingOrder?.id || randomUUID();
    const entitlementId = randomUUID();
    const releaseKey = releaseKeyForSku(sku);
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO orders (id, stripe_session_id, stripe_event_id, sku, product_id, customer_email, amount_total, currency, payment_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(stripe_session_id) DO UPDATE SET updated_at=CURRENT_TIMESTAMP, payment_status=excluded.payment_status`)
        .bind(orderId, session.id, event.id, sku, product.id, email, session.amount_total || null, session.currency || 'usd', session.payment_status || 'paid'),
      env.DB.prepare(`INSERT INTO entitlements (id, order_id, sku, product_id, customer_email, release_key)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(order_id) DO NOTHING`)
        .bind(entitlementId, orderId, sku, product.id, email, releaseKey)
    ]);

    const savedOrder = await (env.DB.prepare('SELECT id FROM orders WHERE stripe_session_id = ?').bind(session.id).first() as Promise<{ id: string } | null>);
    const savedEntitlement = await (env.DB.prepare('SELECT id FROM entitlements WHERE order_id = ?').bind(savedOrder!.id).first() as Promise<{ id: string } | null>);
    const signingSecret = process.env.DOWNLOAD_SIGNING_SECRET || env.DOWNLOAD_SIGNING_SECRET;
    if (!signingSecret) throw new Error('DOWNLOAD_SIGNING_SECRET is not configured');
    const token = createDownloadToken(savedEntitlement!.id, Date.now() + 24 * 60 * 60 * 1000, signingSecret);
    const base = process.env.APP_BASE_URL || env.APP_BASE_URL || req.nextUrl.origin;
    await sendDeliveryEmail(env, savedOrder!.id, email, product.name, `${base}/api/download/${token}`);
    await env.DB.prepare('UPDATE stripe_events SET processed_at=CURRENT_TIMESTAMP, processing_error=NULL WHERE event_id=?').bind(event.id).run();
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown fulfillment error';
    await env.DB.prepare('UPDATE stripe_events SET processing_error=? WHERE event_id=?').bind(message, event.id).run();
    return NextResponse.json({ error: 'Fulfillment failed' }, { status: 500 });
  }
}
