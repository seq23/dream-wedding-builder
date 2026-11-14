import { callerKey, takeSlot, type LimitDB } from './abuse-limits';
import { createDownloadToken, verifyDownloadToken } from './fulfillment';
import { FULL_PLAN_KEY } from './full-plan';
import { metricHash, metricsEnabled, recordAppUnlock } from './app-metrics';

type Entitlement = 'full_plan' | 'printables' | 'day_of_kit';
const grants: Record<string, Entitlement[]> = {
  dw_full_plan: ['full_plan'], dw_planner_printables: ['full_plan', 'printables', 'day_of_kit'],
  dw_printables_topup: ['printables'], dw_day_of_kit: ['day_of_kit'],
  // dw_new_event is a consumable: it never grants a global entitlement (see confirmedNewEvents).
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

/** RevenueCat project "Dream Wedding" (an identifier, not a secret). The server reads the v2 API:
 * REVENUECAT_SECRET is the project's v2 secret key, which RevenueCat refuses on v1 (403, code 7723). */
export const REVENUECAT_PROJECT = 'proj7d196352';
const RC = `https://api.revenuecat.com/v2/projects/${REVENUECAT_PROJECT}`;
/** One store purchase from GET /customers/{id}/purchases, with the store product ID resolved
 * through GET /products (a purchase names RevenueCat's internal product ID only). */
export interface StorePurchase { id: string; product: string; store: string; environment: string; status: string; purchasedAt: number }
export function storePurchases(purchases: unknown, products: unknown): StorePurchase[] {
  const storeIds = new Map<string, string>();
  for (const value of Array.isArray(record(products).items) ? record(products).items as unknown[] : []) {
    const p = record(value);
    if (typeof p.id === 'string' && typeof p.store_identifier === 'string') storeIds.set(p.id, p.store_identifier);
  }
  const list = record(purchases).items;
  return (Array.isArray(list) ? list.slice(0, 1000) : []).map(record).flatMap(p => {
    const product = typeof p.product_id === 'string' ? storeIds.get(p.product_id) : undefined;
    return product && typeof p.id === 'string' && p.id && typeof p.purchased_at === 'number' ? [{
      id: p.id, product, store: String(p.store), environment: String(p.environment), status: String(p.status), purchasedAt: p.purchased_at,
    }] : [];
  });
}
/** A live, owned, one-time App Store or Google Play purchase. Promotional grants are not purchases,
 * and Test Store, refunded, future-dated and (unless the review switch is on) sandbox ones never count. */
const qualifies = (p: StorePurchase, now: number, allowSandbox: boolean) =>
  p.status === 'owned' && (p.store === 'app_store' || p.store === 'play_store') &&
  (p.environment === 'production' || (allowSandbox && p.environment === 'sandbox')) &&
  Number.isFinite(p.purchasedAt) && p.purchasedAt <= now;

/** Only entitlements backed by a real one-time store purchase qualify.
 * RevenueCat's server reply is the authority; client CustomerInfo is never accepted. */
export function confirmedEntitlements(purchases: StorePurchase[], now: number, allowSandbox = false): Entitlement[] {
  const owned = purchases.filter(p => Object.hasOwn(grants, p.product) && qualifies(p, now, allowSandbox));
  return (['full_plan', 'printables', 'day_of_kit'] as const).filter(name => owned.some(p => grants[p.product].includes(name)));
}

/** One opaque, stable token per verified `dw_new_event` store purchase. RevenueCat's
 * server reply is the per-buyer count; the token is a hash of the purchase, so a replayed,
 * repeated or restored purchase always yields the same token and the phone can bind it to
 * one event only. No request input is read. */
export async function confirmedNewEvents(purchases: StorePurchase[], now: number, allowSandbox = false): Promise<string[]> {
  const tokens = new Set<string>();
  for (const p of purchases) {
    if (p.product !== 'dw_new_event' || !qualifies(p, now, allowSandbox)) continue;
    tokens.add(await metricHash(JSON.stringify(['dw-new-event', p.store, p.id])));
  }
  return [...tokens];
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
    const get = (path: string) => upstream(`${RC}${path}`, {
      headers: { Authorization: `Bearer ${env.REVENUECAT_SECRET}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000), redirect: 'error',
    });
    const customer = encodeURIComponent(id);
    const [purchasesReply, productsReply] = await Promise.all([get(`/customers/${customer}/purchases?limit=1000`), get('/products?limit=1000')]);
    // Our key refused is never the buyer's fault: a named stop, not a refusal she can't fix.
    if ([purchasesReply, productsReply].some(r => r.status === 401 || r.status === 403)) return stop('REVENUECAT_KEY_REJECTED');
    if (purchasesReply.status === 404) return refused();
    if (!purchasesReply.ok || !productsReply.ok) return reply(503, { error: 'Could not check your purchase. Please try again.' });
    const [purchasesJson, productsJson] = await Promise.all([customerJson(purchasesReply), customerJson(productsReply)]);
    if (record(purchasesJson).next_page || record(productsJson).next_page) return reply(503, { error: 'Could not check your purchase. Please try again.' });
    const purchases = storePurchases(purchasesJson, productsJson);
    const sandbox = env.APP_SANDBOX_PURCHASES === 'true';
    const active = confirmedEntitlements(purchases, now, sandbox);
    if (!active.length) return refused();
    if (active.includes('full_plan') && metricsEnabled(req, env)) {
      // Use the exact qualifying production purchase; never accept a client sales event.
      const sale = purchases.find(p => Object.hasOwn(grants, p.product) && grants[p.product].includes('full_plan') && qualifies(p, now, false));
      if (sale) {
        try { await recordAppUnlock(env.DB, { store: sale.store, product: sale.product, id: sale.id, purchasedAt: sale.purchasedAt }); }
        catch { console.error(JSON.stringify({ event: 'APP_METRICS_FAILED', stop: 'APP_METRICS_STORAGE_UNAVAILABLE', kind: 'unlock' })); }
      }
    }
    const expiresAt = now + 5 * 60000;
    // Relative URLs avoid trusting a request Host header for delivery destinations.
    const downloads = APP_ASSETS.filter(a => active.includes(a.entitlement as Entitlement)).map(a => ({
      id: a.id, path: `/api/app-unlock?token=${encodeURIComponent(createDownloadToken(`dwapp:${a.id}`, expiresAt, secret))}`,
    }));
    // A new event is an extra event for a buyer whose first (non-consumable) full plan
    // is confirmed; on its own a consumable changes nothing in this reply.
    const newEvents = active.includes('full_plan') ? await confirmedNewEvents(purchases, now, sandbox) : [];
    return reply(200, { active, expiresAt, downloads, newEvents });
  } catch { return reply(503, { error: 'Could not check your purchase. Please try again.' }); }
}
