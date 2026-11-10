import { describe, expect, it } from 'vitest';
import { PUBLIC_PAGE_CACHE_CONTROL, edgeCacheKey, serveWithEdgeCache } from '@/lib/edge-cache';

// Public pages must be cacheable at the edge and vary by host; nothing private may be.
function memoryCache() {
  const store = new Map<string, Response>();
  return { store, match: async (key: string) => store.get(key)?.clone(), put: async (key: string, response: Response) => { store.set(key, response); } };
}
const ctx = () => { const pending: Promise<unknown>[] = []; return { pending, waitUntil: (p: Promise<unknown>) => { pending.push(p); } }; };
const page = (body: string, headers: Record<string, string> = {}) => new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-cache, no-store, max-age=0, must-revalidate', ...headers } });
const get = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

describe('edge cache for public pages', () => {
  it('a public page is served cacheable, the second visit comes from the edge copy, and each host has its own copy', async () => {
    const cache = memoryCache(); let renders = 0;
    const app = (host: string) => () => { renders++; return page(`<html>${host}</html>`); };
    for (const path of ['/', '/free-wedding-planner', '/products/checklist-pdf']) {
      const c = ctx();
      const first = await serveWithEdgeCache(get(`https://weddingchecklistpdf.com${path}`), 'v1', cache, c, app('checklist'));
      await Promise.all(c.pending);
      expect(first.headers.get('cache-control')).toBe(PUBLIC_PAGE_CACHE_CONTROL);
      expect(first.headers.get('cache-control')).not.toMatch(/no-store|private/);
      expect(first.headers.get('x-edge-cache')).toBe('MISS');
      const before = renders;
      const second = await serveWithEdgeCache(get(`https://weddingchecklistpdf.com${path}`), 'v1', cache, ctx(), app('checklist'));
      expect(second.headers.get('x-edge-cache')).toBe('HIT');
      expect(renders).toBe(before);
      expect(await second.text()).toBe('<html>checklist</html>');
    }
    // Another site on the same path gets its own page, never the checklist site's copy.
    const other = await serveWithEdgeCache(get('https://weddingbudgetspreadsheet.com/'), 'v1', cache, ctx(), app('budget'));
    expect(await other.text()).toBe('<html>budget</html>');
    // A new deploy never serves the old deploy's page.
    const next = await serveWithEdgeCache(get('https://weddingchecklistpdf.com/'), 'v2', cache, ctx(), app('checklist v2'));
    expect(await next.text()).toBe('<html>checklist v2</html>');
  });

  it('nothing private is cached or served from cache', async () => {
    const privateRequests: Request[] = [
      get('https://weddingchecklistpdf.com/api/ai-draft'),
      get('https://weddingchecklistpdf.com/api/download/abc'),
      get('https://weddingchecklistpdf.com/api/full-plan/abc'),
      get('https://weddingchecklistpdf.com/admin'),
      get('https://weddingchecklistpdf.com/order/success'),
      get('https://weddingchecklistpdf.com/?utm_source=pinterest&pin=a'),
      get('https://weddingchecklistpdf.com/', { cookie: 'dwb_pin=a' }),
      get('https://weddingchecklistpdf.com/', { authorization: 'Bearer x' }),
      get('https://weddingchecklistpdf.com/', { 'x-forwarded-host': 'weddingbudgetspreadsheet.com' }),
      new Request('https://weddingchecklistpdf.com/', { method: 'POST' })
    ];
    for (const request of privateRequests) {
      expect(edgeCacheKey(request, 'v1'), request.url).toBeNull();
      const cache = memoryCache(); const c = ctx();
      const response = await serveWithEdgeCache(request, 'v1', cache, c, () => page('private'));
      await Promise.all(c.pending);
      expect(cache.store.size).toBe(0);
      expect(response.headers.get('cache-control')).toContain('no-store');
    }
    // A public URL whose response sets a cookie, is not HTML, or is not a 200 is passed through untouched.
    for (const response of [page('x', { 'set-cookie': 'a=b' }), new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }), new Response('', { status: 301, headers: { location: '/x', 'content-type': 'text/html' } })]) {
      const cache = memoryCache(); const c = ctx();
      const out = await serveWithEdgeCache(get('https://weddingchecklistpdf.com/'), 'v1', cache, c, () => response);
      await Promise.all(c.pending);
      expect(cache.store.size).toBe(0);
      expect(out.headers.get('x-edge-cache')).toBeNull();
    }
    // No deploy version, no caching at all.
    const cache = memoryCache();
    await serveWithEdgeCache(get('https://weddingchecklistpdf.com/'), '', undefined, ctx(), () => page('x'));
    expect(cache.store.size).toBe(0);
  });
});
