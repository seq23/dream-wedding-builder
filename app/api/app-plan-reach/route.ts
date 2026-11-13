import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { appPlanReach } from '@/lib/app-metrics';

export async function POST(req: Request) {
  try { return await appPlanReach(req, await runtimeEnv()); }
  catch { return new Response(null, { status: 503, headers: { 'cache-control': 'no-store' } }); }
}
