import { callerKey, takeSlot, type LimitDB } from './abuse-limits';

export interface MetricsEnv { APP_METRICS_ENABLED?: string; DB?: LimitDB }
export const METRICS_HOST = 'weddingchecklistpdf.com';
const headers = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };
export const metricsEnabled = (req: Request, env: MetricsEnv) =>
  env.APP_METRICS_ENABLED === 'true' && new URL(req.url).hostname === METRICS_HOST;
export async function metricHash(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
}

/** First reach per installation; no date, task, email, amount or SDK call.
 * Native production builds send the opaque random id in a header, with no body. */
export async function appPlanReach(req: Request, env: MetricsEnv, now = Date.now()) {
  if (!metricsEnabled(req, env) || !env.DB) return new Response(null, { status: 503, headers });
  if (req.method !== 'POST') return new Response(null, { status: 405, headers });
  const id = req.headers.get('x-dw-installation');
  if (!id || !/^[a-f0-9]{32}$/.test(id) || req.body !== null) return new Response(null, { status: 400, headers });
  try {
    if (!await takeSlot(env.DB, 'app-reach-ip', await callerKey(req.headers), { max: 60, windowS: 3600 }, Math.floor(now / 1000)) ||
        !await takeSlot(env.DB, 'app-reach-day', 'all', { max: 10000, windowS: 86400 }, Math.floor(now / 1000))) {
      return new Response(null, { status: 429, headers });
    }
    await env.DB.prepare('INSERT OR IGNORE INTO app_plan_reach (installation_hash, reached_at) VALUES (?1, ?2)')
      .bind(await metricHash(`dw-installation:${id}`), now).run();
    return new Response(null, { status: 204, headers });
  } catch {
    console.error(JSON.stringify({ event: 'APP_METRICS_FAILED', stop: 'APP_METRICS_STORAGE_UNAVAILABLE', kind: 'reach' }));
    return new Response(null, { status: 503, headers });
  }
}

/** Called only after RevenueCat server verification. Transaction identity, rather
 * than phone/customer identity, keeps Restore on another phone from adding sales. */
export async function recordAppUnlock(db: LimitDB, transaction: { store: string; product: string; id: string; purchasedAt: number }) {
  await db.prepare('INSERT OR IGNORE INTO app_confirmed_unlocks (transaction_hash, purchased_at) VALUES (?1, ?2)')
    .bind(await metricHash(JSON.stringify(['dw-transaction', transaction.store, transaction.product, transaction.id])), transaction.purchasedAt).run();
}
