import { runtimeEnv } from '@/lib/cloudflare-runtime';

/** True only when the Worker's partner-sharing route is switched on (APP_SHARING_ENABLED=true,
 * the same switch app/api/plan-share/route.ts reads). An unreadable env counts as off: a page
 * that cannot tell must not invite someone into a shared plan that cannot open. */
export async function sharingSwitchedOn(read: () => Promise<{ APP_SHARING_ENABLED?: string }> = runtimeEnv): Promise<boolean> {
  try { return (await read()).APP_SHARING_ENABLED === 'true'; } catch { return false; }
}
