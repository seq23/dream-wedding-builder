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
// What is never cached: anything that is not a plain GET of a public page (or of
// robots.txt, sitemap.xml, llms.txt) - /api
// (sign-ups, checkout, the AI draft, signed downloads), /admin, /order, any URL with a
// query string (pin and campaign links set a cookie and are counted), any request that
// carries one of the app's own cookies (dwb_*) or authorization, and any response that is not a 200 HTML page or
// that sets a cookie.

// CPU, 13 Nov 2026: the Worker's CPU was projected past the 30M ms a month included
// in the plan, three-quarters of it this site's page renders, mostly for crawlers.
// Measured over a day: robots.txt cost ~180 ms a request and scanner probes for
// /wp-admin ~220 ms (a full 404 render), and any visitor carrying an analytics cookie
// skipped the copy. So: robots.txt, sitemap.xml and llms.txt are kept like pages;
// only the app's own cookies (dwb_*) bypass the copy; scanner paths get a plain 404
// without rendering; and a copy lasts a day (a deploy still starts fresh, the version
// id is in the key).
export const EDGE_TTL_SECONDS = 86400;
/** What a browser is told: it may reuse the page for a minute; the edge copy lasts a day. */
export const PUBLIC_PAGE_CACHE_CONTROL = `public, max-age=60, s-maxage=${EDGE_TTL_SECONDS}`;
const PRIVATE_PREFIXES = ['/api', '/admin', '/order', '/_next'];

/** The cache key for a request that may be answered from the edge copy, or null when it must reach the app. */
export function edgeCacheKey(request: Request, version: string): string | null {
  if (request.method !== 'GET') return null;
  const url = new URL(request.url);
  if (url.search) return null;
  if (PRIVATE_PREFIXES.some(prefix => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))) return null;
  // Only the app's own cookies change what a page may do (admin session, pin attribution); analytics cookies do not.
  if (/(?:^|;\s*)dwb_/.test(request.headers.get('cookie') ?? '') || request.headers.get('authorization')) return null;
  // The app trusts x-forwarded-host for the site's identity. A request that sends one
  // different from the URL's own host must never write (or read) the copy for that URL.
  const forwarded = request.headers.get('x-forwarded-host');
  if (forwarded && forwarded.toLowerCase() !== url.host.toLowerCase()) return null;
  return `${url.origin}${url.pathname}?__edge=${encodeURIComponent(version)}`;
}

/** True when a response from the app is a public page that may be kept: a 200 HTML page that sets no cookie. */
export function isCacheablePage(response: Response, pathname = ''): boolean {
  const type = response.headers.get('content-type') ?? '';
  const publicFile = PUBLIC_FILES.has(pathname) && /text\/plain|xml/.test(type);
  return response.status === 200 && (type.includes('text/html') || publicFile) && !response.headers.has('set-cookie');
}
/** Public text files every crawler asks for, the same for everyone. */
const PUBLIC_FILES = new Set(['/robots.txt', '/sitemap.xml', '/llms.txt']);

// Paths no page of ours has ever had: WordPress and PHP probes, dotfiles. Answered
// with a plain 404 here, so a scanner never costs a full page render.
const SCANNER = /^\/(?:wp-|wordpress|xmlrpc|cgi-bin|phpmyadmin|\.env|\.git|\.aws|\.ds_store|vendor\/phpunit)|\.php(?:$|\/)/i;
export function isScannerPath(pathname: string): boolean { return SCANNER.test(pathname); }

type CacheLike = { match(key: string): Promise<Response | undefined>; put(key: string, response: Response): Promise<void> };
type Ctx = { waitUntil(promise: Promise<unknown>): void };

// CPU, 14 Nov 2026: the fix above did not bring the pace down (35.0M ms a month).
// Measured with `wrangler tail`: the expensive requests are first visits that miss the
// copy, ~110-280 ms each, and even robots.txt cost ~140 ms on a miss. The cost is not
// the page: it is loading the Next server into a fresh Worker. The Cache API copy lives
// in one Cloudflare data centre, crawlers arrive from dozens of them, and every deploy
// (several a day) empties every copy, so most crawler visits were that first visit.
// So one shared copy per page is also kept in R2 (free tier: 10M reads, 1M writes a
// month; this adds at most one read per local miss and one write per page per deploy).
// A data centre with no copy reads R2 instead of starting Next. One object per host and
// path, overwritten by each deploy, so storage never grows; the deploy's version id is
// stored with it and an older version counts as no copy.
type R2Object = { body: ReadableStream; httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> };
export type SharedStore = {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: ArrayBuffer | string, options: { httpMetadata: { contentType: string }; customMetadata: Record<string, string> }): Promise<unknown>;
};
/** The R2 key for a page's shared copy: one per host and path, whatever the deploy. */
export function sharedCopyKey(request: Request): string {
  const url = new URL(request.url);
  return `edge-pages/${url.host.toLowerCase()}${url.pathname}`;
}
const SHARED_MAX_BYTES = 2_000_000;

async function readShared(store: SharedStore | undefined, request: Request, version: string): Promise<Response | null> {
  if (!store) return null;
  const object = await store.get(sharedCopyKey(request)).catch(() => null);
  if (!object || object.customMetadata?.version !== version) return null;
  return new Response(object.body, { status: 200, headers: { 'content-type': object.httpMetadata?.contentType ?? 'text/html; charset=utf-8' } });
}

/** Answers from the edge copy when there is one; otherwise asks the app and keeps a public page for next time. */
export async function serveWithEdgeCache(request: Request, version: string, cache: CacheLike | undefined, ctx: Ctx, app: () => Promise<Response> | Response, shared?: SharedStore): Promise<Response> {
  if (isScannerPath(new URL(request.url).pathname)) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' } });
  const key = cache ? edgeCacheKey(request, version) : null;
  if (!key || !cache) return app();
  const hit = await cache.match(key).catch(() => undefined);
  // A stored copy comes back with the zone's browser lifetime (4 hours) in place of ours; put ours back so a browser re-asks after a minute.
  if (hit) { const response = new Response(hit.body, hit); response.headers.set('Cache-Control', PUBLIC_PAGE_CACHE_CONTROL); response.headers.set('x-edge-cache', 'HIT'); return response; }
  const fromShared = await readShared(shared, request, version);
  if (fromShared) {
    fromShared.headers.set('Cache-Control', PUBLIC_PAGE_CACHE_CONTROL);
    fromShared.headers.set('x-edge-cache', 'SHARED');
    ctx.waitUntil(cache.put(key, fromShared.clone()).catch(() => undefined));
    return fromShared;
  }
  const fresh = await app();
  if (!isCacheablePage(fresh, new URL(request.url).pathname)) return fresh;
  const response = new Response(fresh.body, fresh);
  response.headers.set('Cache-Control', PUBLIC_PAGE_CACHE_CONTROL);
  response.headers.set('x-edge-cache', 'MISS');
  ctx.waitUntil(cache.put(key, response.clone()).catch(() => undefined));
  if (shared) {
    const copy = response.clone();
    const contentType = response.headers.get('content-type') ?? 'text/html; charset=utf-8';
    ctx.waitUntil(copy.arrayBuffer().then(body => body.byteLength > SHARED_MAX_BYTES ? undefined
      : shared.put(sharedCopyKey(request), body, { httpMetadata: { contentType }, customMetadata: { version } })).catch(() => undefined));
  }
  return response;
}
