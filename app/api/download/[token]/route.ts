import { NextRequest, NextResponse } from 'next/server';
import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { isExpiredDownloadToken, verifyDownloadToken } from '@/lib/fulfillment';
import { productBySku } from '@/lib/products';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const env = await runtimeEnv();
  const secret = process.env.DOWNLOAD_SIGNING_SECRET || env.DOWNLOAD_SIGNING_SECRET;
  if (!env.DB || !env.PRODUCT_RELEASES || !secret) return NextResponse.json({ error: 'Downloads are unavailable just now. Please try again in a few minutes.' }, { status: 503 });
  const verified = verifyDownloadToken(token, secret);
  // A link we issued that has run out goes to the page where she gets a fresh one by
  // email (app/order/link). A forged or broken link is refused, never offered anything.
  if (!verified && isExpiredDownloadToken(token, secret)) return NextResponse.redirect(new URL('/order/link?expired=1', req.url), 303);
  if (!verified) return NextResponse.json({ error: 'This download link does not work. Open the newest link in your order email.' }, { status: 401 });
  const entitlement = await (env.DB.prepare('SELECT id, sku, release_key, status FROM entitlements WHERE id=?').bind(verified.entitlementId).first() as Promise<any>);
  if (!entitlement || entitlement.status !== 'ACTIVE') return NextResponse.json({ error: 'This purchase is no longer active. If that looks wrong, email info@weddingchecklistpdf.com.' }, { status: 403 });
  const object = await env.PRODUCT_RELEASES.get(entitlement.release_key);
  if (!object) return NextResponse.json({ error: 'Your files are not ready to download yet. Email info@weddingchecklistpdf.com and we will send them to you.' }, { status: 404 });
  await env.DB.prepare('UPDATE entitlements SET download_count=download_count+1, last_downloaded_at=CURRENT_TIMESTAMP WHERE id=?').bind(entitlement.id).run();
  const product = productBySku(entitlement.sku);
  const filename = `${product?.id || 'dream-wedding-product'}.zip`;
  const headers = new Headers();
  // Set from the stored metadata rather than writeHttpMetadata(): the same result in the Worker,
  // and it also works through the local dev binding proxy, which cannot pass a Headers object.
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/zip');
  headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new NextResponse(object.body, { headers });
}
