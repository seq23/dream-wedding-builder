import { NextRequest, NextResponse } from 'next/server';
import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { verifyDownloadToken } from '@/lib/fulfillment';
import { FULL_PLAN_PRODUCT_IDS, FULL_PLAN_STOP, loadFullPlan } from '@/lib/full-plan';
import { productBySku } from '@/lib/products';

export const dynamic = 'force-dynamic';

const PRIVATE = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' };

// The paid task list, for a buyer only. Same signed token and entitlement check as the
// file download. Her wedding date never comes here: the page dates the tasks in her
// browser. A missing list is a named stop and a 503 the page turns into "download your
// files instead", never an empty plan.
export async function GET(_req: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const env = await runtimeEnv();
  const secret = process.env.DOWNLOAD_SIGNING_SECRET || env.DOWNLOAD_SIGNING_SECRET;
  if (!env.DB || !secret) return NextResponse.json({ ok: false, error: 'The plan service is unavailable.' }, { status: 503, headers: PRIVATE });
  const verified = verifyDownloadToken(token, secret);
  if (!verified) return NextResponse.json({ ok: false, error: 'This link is invalid or has expired. Use the newest link in your order email.' }, { status: 401, headers: PRIVATE });
  const entitlement = await (env.DB.prepare('SELECT id, sku, status FROM entitlements WHERE id=?').bind(verified.entitlementId).first() as Promise<{ id: string; sku: string; status: string } | null>);
  if (!entitlement || entitlement.status !== 'ACTIVE') return NextResponse.json({ ok: false, error: 'This purchase is not active.' }, { status: 403, headers: PRIVATE });
  const product = productBySku(entitlement.sku);
  if (!product || !FULL_PLAN_PRODUCT_IDS.includes(product.id)) return NextResponse.json({ ok: false, error: 'The dated plan comes with the Wedding Checklist PDF.' }, { status: 403, headers: PRIVATE });
  const list = await loadFullPlan(env.PRODUCT_RELEASES as never, 'api/full-plan');
  if (!list) return NextResponse.json({ ok: false, stop: FULL_PLAN_STOP, error: 'Your dated plan is not available right now. Your files are still ready to download.', download_url: `/api/download/${token}` }, { status: 503, headers: PRIVATE });
  return NextResponse.json({ ok: true, windows: list.windows, tasks: list.tasks, download_url: `/api/download/${token}` }, { headers: PRIVATE });
}
