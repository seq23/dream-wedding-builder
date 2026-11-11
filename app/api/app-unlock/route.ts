import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { appUnlock } from '@/lib/app-unlock';

async function handle(req: Request) {
  try { return await appUnlock(req, await runtimeEnv()); }
  catch { return appUnlock(req, {}); }
}
export { handle as POST, handle as GET };
