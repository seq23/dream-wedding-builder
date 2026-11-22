import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { reviewUnlock } from '@/lib/review-unlock';

// POST /api/review/unlock: the Play reviewer's code (lib/review-unlock.ts). No env = closed (404), never open.
export async function POST(req: Request) {
  let env;
  try { env = await runtimeEnv(); } catch { env = {}; }
  try { return await reviewUnlock(req, env); }
  catch { return Response.json({ error: 'TRY_AGAIN' }, { status: 503, headers: { 'cache-control': 'no-store' } }); }
}
