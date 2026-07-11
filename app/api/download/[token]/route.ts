import { NextRequest, NextResponse } from 'next/server';
import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { verifyDownloadToken } from '@/lib/fulfillment';
import { productBySku } from '@/lib/products';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const env = await runtimeEnv();
  const secret = process.env.DOWNLOAD_SIGNING_SECRET || env.DOWNLOAD_SIGNING_SECRET;
  if (!env.DB || !env.PRODUCT_RELEASES || !secret) return NextResponse.json({ error: 'Download service is unavailable' }, { status: 503 });
  const verified = verifyDownloadToken(token, secret);
  if (!verified) return NextResponse.json({ error: 'This download link is invalid or expired' }, { status: 401 });
  const entitlement = await (env.DB.prepare('SELECT id, sku, release_key, status FROM entitlements WHERE id=?').bind(verified.entitlementId).first() as Promise<any>);
  if (!entitlement || entitlement.status !== 'ACTIVE') return NextResponse.json({ error: 'Entitlement is not active' }, { status: 403 });
  const object = await env.PRODUCT_RELEASES.get(entitlement.release_key);
  if (!object) return NextResponse.json({ error: 'Product release is not available yet' }, { status: 404 });
  await env.DB.prepare('UPDATE entitlements SET download_count=download_count+1, last_downloaded_at=CURRENT_TIMESTAMP WHERE id=?').bind(entitlement.id).run();
  const product = productBySku(entitlement.sku);
  const filename = `${product?.id || 'dream-wedding-product'}.zip`;
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new NextResponse(object.body, { headers });
}
