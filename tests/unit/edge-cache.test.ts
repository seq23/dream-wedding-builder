import { describe, expect, it } from 'vitest';
import { PUBLIC_PAGE_CACHE_CONTROL, edgeCacheKey, isScannerPath, serveWithEdgeCache, sharedCopyKey, type SharedStore } from '@/lib/edge-cache';

// Public pages must be cacheable at the edge and vary by host; nothing private may be.
function memoryCache() {
  const store = new Map<string, Response>();
  return { store, match: async (key: string) => store.get(key)?.clone(), put: async (key: string, response: Response) => { store.set(key, response); } };
}
const ctx = () => { const pending: Promise<unknown>[] = []; return { pending, waitUntil: (p: Promise<unknown>) => { pending.push(p); } }; };
const page = (body: string, headers: Record<string, string> = {}) => new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-cache, no-store, max-age=0, must-revalidate', ...headers } });
const get = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

describe('edge cache for public pages', () => {
  it('a stored copy that comes back with a longer browser lifetime is served with ours', async () => {
    // Cloudflare hands a stored page back with the zone's 4-hour browser lifetime.
    const cache = { match: async () => new Response('<html>x</html>', { status: 200, headers: { 'content-type': 'text/html', 'cache-control': 'public, max-age=14400, s-maxage=3600' } }), put: async () => undefined };
    const hit = await serveWithEdgeCache(get('https://weddingchecklistpdf.com/'), 'v1', cache, ctx(), () => page('fresh'));
    expect(hit.headers.get('x-edge-cache')).toBe('HIT');
    expect(hit.headers.get('cache-control')).toBe(PUBLIC_PAGE_CACHE_CONTROL);
  });
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
      get('https://weddingchecklistpdf.com/', { cookie: '_clck=1; dwb_admin_session=x' }),
      get('https://weddingchecklistpdf.com/api/wedding-read'),
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

  it('a visitor with only analytics cookies gets the edge copy; crawler files are kept; scanner probes never render', async () => {
    const cache = memoryCache(); let renders = 0;
    const app = () => { renders++; return page('<html>home</html>'); };
    const c = ctx();
    await serveWithEdgeCache(get('https://weddingchecklistpdf.com/'), 'v1', cache, c, app);
    await Promise.all(c.pending);
    const withClarity = await serveWithEdgeCache(get('https://weddingchecklistpdf.com/', { cookie: '_clck=abc; _clsk=def' }), 'v1', cache, ctx(), app);
    expect(withClarity.headers.get('x-edge-cache')).toBe('HIT');
    expect(renders).toBe(1);
    for (const path of ['/robots.txt', '/sitemap.xml', '/llms.txt']) {
      const type = path.endsWith('.xml') ? 'application/xml' : 'text/plain; charset=utf-8';
      let n = 0; const file = () => { n++; return new Response('x', { status: 200, headers: { 'content-type': type } }); };
      const c2 = ctx();
      await serveWithEdgeCache(get(`https://weddingchecklistpdf.com${path}`), 'v1', cache, c2, file);
      await Promise.all(c2.pending);
      expect((await serveWithEdgeCache(get(`https://weddingchecklistpdf.com${path}`), 'v1', cache, ctx(), file)).headers.get('x-edge-cache'), path).toBe('HIT');
      expect(n).toBe(1);
    }
    // A JSON or text response anywhere else is still never kept.
    const c3 = ctx(); const other = memoryCache();
    await serveWithEdgeCache(get('https://weddingchecklistpdf.com/feed.txt'), 'v1', other, c3, () => new Response('x', { status: 200, headers: { 'content-type': 'text/plain' } }));
    await Promise.all(c3.pending);
    expect(other.store.size).toBe(0);
    for (const probe of ['/wp-admin/install.php?step=1', '/wp-login.php', '/xmlrpc.php', '/.env', '/.git/config', '/index.php', '/cgi-bin/x']) {
      let rendered = false;
      const r = await serveWithEdgeCache(get(`https://weddingchecklistpdf.com${probe}`), 'v1', memoryCache(), ctx(), () => { rendered = true; return page('x'); });
      expect(r.status, probe).toBe(404);
      expect(rendered, probe).toBe(false);
    }
    // Real pages are never mistaken for probes.
    for (const path of ['/', '/free-wedding-planner', '/wedding-checklist', '/products/checklist-pdf', '/questions/what-to-do-first', '/amazon/wedding-day-timeline']) expect(isScannerPath(path), path).toBe(false);
  });

  // CPU guard (14 Nov 2026): a first visit in a data centre with no copy started Next
  // (~110-280 ms). The shared R2 copy must answer it without rendering.
  it('a page rendered once is served in every other data centre from the shared copy, without rendering', async () => {
    const objects = new Map<string, { body: string; type: string; meta: Record<string, string> }>();
    const shared: SharedStore = {
      get: async (k) => { const o = objects.get(k); return o ? { body: new Response(o.body).body!, httpMetadata: { contentType: o.type }, customMetadata: o.meta } : null; },
      put: async (k, v, opts) => { objects.set(k, { body: typeof v === 'string' ? v : new TextDecoder().decode(v), type: opts.httpMetadata.contentType, meta: opts.customMetadata }); }
    };
    let renders = 0;
    const app = (label: string) => () => { renders++; return page(`<html>${label}</html>`); };
    const paths = ['/', '/free-wedding-planner', '/guides', '/robots.txt', '/sitemap.xml'];
    for (const path of paths) {
      const isFile = path.endsWith('.txt') || path.endsWith('.xml');
      const render = isFile ? () => { renders++; return new Response('file', { status: 200, headers: { 'content-type': path.endsWith('.xml') ? 'application/xml' : 'text/plain' } }); } : app(path);
      const c = ctx();
      await serveWithEdgeCache(get(`https://weddingchecklistpdf.com${path}`), 'v1', memoryCache(), c, render, shared);
      await Promise.all(c.pending);
    }
    expect(renders).toBe(paths.length);
    expect(objects.size).toBe(paths.length);
    // Ten other data centres, each with an empty local cache: nothing renders.
    for (let dc = 0; dc < 10; dc++) for (const path of paths) {
      const local = memoryCache(); const c = ctx();
      const r = await serveWithEdgeCache(get(`https://weddingchecklistpdf.com${path}`), 'v1', local, c, app('never'), shared);
      await Promise.all(c.pending);
      expect(r.headers.get('x-edge-cache'), path).toBe('SHARED');
      expect(r.headers.get('cache-control')).toBe(PUBLIC_PAGE_CACHE_CONTROL);
      expect(await r.text()).not.toContain('never');
      expect(local.store.size, 'the data centre keeps its own copy too').toBe(1);
    }
    expect(renders).toBe(paths.length);
    // Another host on the same path never gets this host's copy.
    expect(sharedCopyKey(get('https://weddingbudgetspreadsheet.com/'))).not.toBe(sharedCopyKey(get('https://weddingchecklistpdf.com/')));
    const other = await serveWithEdgeCache(get('https://weddingbudgetspreadsheet.com/'), 'v1', memoryCache(), ctx(), app('budget'), shared);
    expect(await other.text()).toBe('<html>budget</html>');
    // A new deploy renders again and overwrites the one object (storage never grows).
    const before = objects.size; const c = ctx();
    const fresh = await serveWithEdgeCache(get('https://weddingchecklistpdf.com/'), 'v2', memoryCache(), c, app('v2'), shared);
    await Promise.all(c.pending);
    expect(await fresh.text()).toBe('<html>v2</html>');
    expect(objects.get(sharedCopyKey(get('https://weddingchecklistpdf.com/')))?.meta.version).toBe('v2');
    // Private requests never read or write the shared copy.
    for (const request of [get('https://weddingchecklistpdf.com/api/wedding-read'), get('https://weddingchecklistpdf.com/', { cookie: 'dwb_admin_session=x' }), get('https://weddingchecklistpdf.com/?utm_source=pinterest')]) {
      const c2 = ctx(); const r = await serveWithEdgeCache(request, 'v2', memoryCache(), c2, () => page('private'), shared);
      await Promise.all(c2.pending);
      expect(await r.text(), request.url).toBe('private');
    }
    expect(objects.size).toBe(before + 1);
  });
});
