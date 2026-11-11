import { NextResponse } from 'next/server';
import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { FULL_PLAN_STOP, fullPlanCounts, loadFullPlan } from '@/lib/full-plan';

export const dynamic = 'force-dynamic';

// Public counts of the paid task list, and nothing else from it. Two jobs: the site
// reads its numbers here (so no count is ever typed), and the post-deploy live check
// (scripts/validate/live-check.mjs) fails when this is not 200, so a missing list is a
// red run someone sees rather than buyers quietly getting only the zip.
export async function GET() {
  const env = await runtimeEnv();
  const list = await loadFullPlan(env.PRODUCT_RELEASES as never, 'api/health/full-plan');
  if (!list) return NextResponse.json({ status: FULL_PLAN_STOP }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json({ status: 'OK', ...fullPlanCounts(list) }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
