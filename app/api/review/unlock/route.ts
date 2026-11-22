import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { RuntimeEnv } from '@/lib/cloudflare-runtime';
import { reviewUnlock, type WaitUntil } from '@/lib/review-unlock';

// POST /api/review/unlock: the Play reviewer's code (lib/review-unlock.ts). No env = closed (404), never open.
// The Open Loops alert runs under ctx.waitUntil: off the response path, and not cancelled when the app hangs up.
export async function POST(req: Request) {
  let env: RuntimeEnv = {}, waitUntil: WaitUntil | undefined;
  try {
    const cf = await getCloudflareContext({ async: true });
    env = cf.env as unknown as RuntimeEnv;
    waitUntil = work => cf.ctx.waitUntil(work);
  } catch { env = {}; }
  try { return await reviewUnlock(req, env, fetch, Date.now(), waitUntil); }
  catch { return Response.json({ error: 'TRY_AGAIN' }, { status: 503, headers: { 'cache-control': 'no-store' } }); }
}
