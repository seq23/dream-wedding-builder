import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { planShare } from '@/lib/plan-share';

async function handle(req: Request) {
  try {
    const env = await runtimeEnv();
    return planShare(req, env.DB, env.APP_SHARING_ENABLED === 'true');
  } catch { return planShare(req, undefined, false); }
}
export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
