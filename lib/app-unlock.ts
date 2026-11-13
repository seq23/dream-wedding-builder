import { callerKey, takeSlot, type LimitDB } from './abuse-limits';
import { createDownloadToken, verifyDownloadToken } from './fulfillment';
import { FULL_PLAN_KEY } from './full-plan';
import { metricsEnabled, recordAppUnlock } from './app-metrics';

type Entitlement = 'full_plan' | 'printables' | 'day_of_kit';
const grants: Record<string, Entitlement[]> = {
  dw_full_plan: ['full_plan'], dw_planner_printables: ['full_plan', 'printables', 'day_of_kit'],
  dw_printables_topup: ['printables'], dw_day_of_kit: ['day_of_kit'],
  // Consumables are bound to new events by the ledger, never a global entitlement.
};
const traditions = ['catholic', 'chinese-tea', 'hindu', 'jewish', 'mexican', 'muslim-nikah', 'nigerian'];
export const APP_ASSETS = [
  { id: 'full-plan', entitlement: 'full_plan', key: FULL_PLAN_KEY },
  ...traditions.map(id => ({ id: `tradition-${id}`, entitlement: 'full_plan', key: `packs/traditions/${id}-v1.json` })),
  { id: 'printables', entitlement: 'printables', key: 'app/printables-v1.zip' },
  { id: 'day-of-kit', entitlement: 'day_of_kit', key: 'app/day-of-kit-v1.zip' },
] as const;
export interface UnlockEnv {
  APP_PURCHASES_ENABLED?: string;
  /** 'true' only while Apple or Google review the app, or for her own test purchase:
   * store reviewers buy in the sandbox, and a refused sandbox purchase fails review. */
  APP_SANDBOX_PURCHASES?: string;
  APP_METRICS_ENABLED?: string;
  REVENUECAT_SECRET?: string;
  DOWNLOAD_SIGNING_SECRET?: string;
  DB?: LimitDB;
  PRODUCT_RELEASES?: { get(key: string): Promise<{ body: ReadableStream; size: number } | null> };
}
const reply = (status: number, body: object) => Response.json(body, { status, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'referrer-policy': 'no-referrer' } });
const refused = () => reply(403, { error: 'Purchase could not be confirmed. Restore your purchase and try again.' });
function stop(name: string) {
  console.error(JSON.stringify({ event: 'NAMED_STOP', stop: name, where: 'app-unlock' }));
  return reply(503, { error: 'Purchases are not available yet.', stop: name });
}
const record = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};

async function customerJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Missing verification response');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 512 * 1024) { await reader.cancel(); throw new Error('Verification response too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Only current entitlements backed by a real one-time store transaction qualify.
 * RevenueCat's server reply is the authority; client CustomerInfo is never accepted. */
export function confirmedEntitlements(raw: unknown, now: number, allowSandbox = false): Entitlement[] {
  const subscriber = record(record(raw).subscriber);
  const entitlements = record(subscriber.entitlements);
  const transactions = record(subscriber.non_subscriptions);
  return (['full_plan', 'printables', 'day_of_kit'] as const).filter(name => {
    const e = record(entitlements[name]);
    const product = typeof e.product_identifier === 'string' ? e.product_identifier : '';
    if (!Object.hasOwn(grants, product) || !grants[product].includes(name) || e.expires_date !== null) return false;
    if (typeof e.purchase_date !== 'string' || !Number.isFinite(Date.parse(e.purchase_date)) || Date.parse(e.purchase_date) > now) return false;
    const purchases = transactions[product];
    return Array.isArray(purchases) && purchases.some(value => {
      const t = record(value);
      return (t.is_sandbox === false || (allowSandbox && t.is_sandbox === true)) && (t.store === 'app_store' || t.store === 'play_store') &&
        typeof t.id === 'string' && !!t.id && t.purchase_date === e.purchase_date && !t.refunded_at;
    });
  });
}

/** Anonymous SDK IDs are random bearer capabilities. Never accept emails or custom
 * predictable IDs, put them in URLs, log them, or accept entitlement names from a phone. */
export async function appUnlock(req: Request, env: UnlockEnv, upstream: typeof fetch = fetch, now = Date.now()): Promise<Response> {
  if (!env.REVENUECAT_SECRET) return stop('REVENUECAT_SECRET_MISSING');
  if (env.APP_PURCHASES_ENABLED !== 'true') return stop('DW_STORE_NOT_SET_UP');
  if (!env.DOWNLOAD_SIGNING_SECRET || !env.DB || !env.PRODUCT_RELEASES) return stop('APP_DELIVERY_NOT_CONFIGURED');
  const secret = `app-unlock-v1:${env.DOWNLOAD_SIGNING_SECRET}`;
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const signed = verifyDownloadToken(url.searchParams.get('token') ?? '', secret, now);
      const asset = APP_ASSETS.find(a => `dwapp:${a.id}` === signed?.entitlementId);
      if (!asset) return refused();
      const object = await env.PRODUCT_RELEASES.get(asset.key);
      if (!object) return stop('APP_PAID_ASSET_MISSING');
      return new Response(object.body, { headers: {
        'content-type': asset.key.endsWith('.json') ? 'application/json' : 'application/zip',
        'content-length': String(object.size), 'cache-control': 'private, no-store',
        'x-robots-tag': 'noindex', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff',
      } });
    }
    if (req.method !== 'POST') return reply(405, { error: 'Method unavailable.' });
    const id = req.headers.get('authorization')?.match(/^Bearer (\$RCAnonymousID:[a-f0-9]{32})$/)?.[1];
    if (!id) return refused();
    if (!await takeSlot(env.DB, 'app-unlock-ip', await callerKey(req.headers), { max: 20, windowS: 3600 }, Math.floor(now / 1000)) ||
        !await takeSlot(env.DB, 'app-unlock-day', 'all', { max: 10000, windowS: 86400 }, Math.floor(now / 1000))) {
      return reply(429, { error: 'Purchases are busy. Please try again later.' });
    }
    const response = await upstream(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${env.REVENUECAT_SECRET}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000), redirect: 'error',
    });
    if (response.status === 404) return refused();
    if (!response.ok) return reply(503, { error: 'Could not check your purchase. Please try again.' });
    const customer = await customerJson(response);
    const active = confirmedEntitlements(customer, now, env.APP_SANDBOX_PURCHASES === 'true');
    if (!active.length) return refused();
    if (active.includes('full_plan') && metricsEnabled(req, env)) {
      // Use the exact qualifying transaction; never accept a client sales event.
      const subscriber = record(record(customer).subscriber);
      const entitlement = record(record(subscriber.entitlements).full_plan);
      const product = String(entitlement.product_identifier);
      const transactions = record(subscriber.non_subscriptions)[product];
      const transaction = Array.isArray(transactions) ? transactions.map(record).find(t =>
        t.is_sandbox === false && (t.store === 'app_store' || t.store === 'play_store') &&
        typeof t.id === 'string' && !!t.id && t.purchase_date === entitlement.purchase_date && !t.refunded_at) : undefined;
      if (transaction) {
        try { await recordAppUnlock(env.DB, { store: String(transaction.store), product, id: String(transaction.id), purchasedAt: Date.parse(String(transaction.purchase_date)) }); }
        catch { console.error(JSON.stringify({ event: 'APP_METRICS_FAILED', stop: 'APP_METRICS_STORAGE_UNAVAILABLE', kind: 'unlock' })); }
      }
    }
    const expiresAt = now + 5 * 60000;
    // Relative URLs avoid trusting a request Host header for delivery destinations.
    const downloads = APP_ASSETS.filter(a => active.includes(a.entitlement as Entitlement)).map(a => ({
      id: a.id, path: `/api/app-unlock?token=${encodeURIComponent(createDownloadToken(`dwapp:${a.id}`, expiresAt, secret))}`,
    }));
    return reply(200, { active, expiresAt, downloads });
  } catch { return reply(503, { error: 'Could not check your purchase. Please try again.' }); }
}
