// Edge caching for public pages, at $0 (owner, 10 Nov 2026).
//
// Why pages were uncached: the root layout reads the request host (one Worker serves
// every site and each needs its own name, icons and analytics token), which makes
// every page a dynamic render, and Next answers a dynamic render with
// "private, no-cache, no-store". So each visit re-rendered the page in the Worker.
//
// What this does: the Worker entry (worker.ts) keeps a copy of each public HTML page
// in Cloudflare's own cache (the Cache API, free) and answers from it. The key is the
// full URL, so it varies by host, plus the deploy's version id, so a new deploy never
// serves an old page that points at assets that no longer exist.
//
// What is never cached: anything that is not a plain GET of a public page - /api
// (sign-ups, checkout, the AI draft, signed downloads), /admin, /order, any URL with a
// query string (pin and campaign links set a cookie and are counted), any request that
// carries a cookie or authorization, and any response that is not a 200 HTML page or
// that sets a cookie.

export const EDGE_TTL_SECONDS = 3600;
/** What a browser is told: it may reuse the page for a minute; the edge copy lasts an hour. */
export const PUBLIC_PAGE_CACHE_CONTROL = `public, max-age=60, s-maxage=${EDGE_TTL_SECONDS}`;
const PRIVATE_PREFIXES = ['/api', '/admin', '/order', '/_next'];

/** The cache key for a request that may be answered from the edge copy, or null when it must reach the app. */
export function edgeCacheKey(request: Request, version: string): string | null {
  if (request.method !== 'GET') return null;
  const url = new URL(request.url);
  if (url.search) return null;
  if (PRIVATE_PREFIXES.some(prefix => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))) return null;
  if (request.headers.get('cookie') || request.headers.get('authorization')) return null;
  // The app trusts x-forwarded-host for the site's identity. A request that sends one
  // different from the URL's own host must never write (or read) the copy for that URL.
  const forwarded = request.headers.get('x-forwarded-host');
  if (forwarded && forwarded.toLowerCase() !== url.host.toLowerCase()) return null;
  return `${url.origin}${url.pathname}?__edge=${encodeURIComponent(version)}`;
}

/** True when a response from the app is a public page that may be kept: a 200 HTML page that sets no cookie. */
export function isCacheablePage(response: Response): boolean {
  return response.status === 200 && (response.headers.get('content-type') ?? '').includes('text/html') && !response.headers.has('set-cookie');
}

type CacheLike = { match(key: string): Promise<Response | undefined>; put(key: string, response: Response): Promise<void> };
type Ctx = { waitUntil(promise: Promise<unknown>): void };

/** Answers from the edge copy when there is one; otherwise asks the app and keeps a public page for next time. */
export async function serveWithEdgeCache(request: Request, version: string, cache: CacheLike | undefined, ctx: Ctx, app: () => Promise<Response> | Response): Promise<Response> {
  const key = cache ? edgeCacheKey(request, version) : null;
  if (!key || !cache) return app();
  const hit = await cache.match(key).catch(() => undefined);
  if (hit) { const response = new Response(hit.body, hit); response.headers.set('x-edge-cache', 'HIT'); return response; }
  const fresh = await app();
  if (!isCacheablePage(fresh)) return fresh;
  const response = new Response(fresh.body, fresh);
  response.headers.set('Cache-Control', PUBLIC_PAGE_CACHE_CONTROL);
  response.headers.set('x-edge-cache', 'MISS');
  ctx.waitUntil(cache.put(key, response.clone()).catch(() => undefined));
  return response;
}
