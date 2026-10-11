// Guard: each host serves its own favicon.ico, apple-touch-icon.png, manifest icons
// and site.webmanifest, and the root layout links them on that host.
// Origin (2026-10-11): /favicon.ico answered 404 on all four sites and no page
// carried <link rel="icon">.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { HOSTS, pngSize } from './helpers/site-homes';

let currentHost = 'weddingchecklistpdf.com';
vi.mock('next/headers', () => ({ headers: async () => new Headers({ host: currentHost }) }));

const ROUTES = { 'favicon.ico': 'image/x-icon', 'apple-touch-icon.png': 'image/png', 'icon-192.png': 'image/png', 'icon-512.png': 'image/png' } as const;
const PNG_SIZES: Record<string, number> = { 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512 };

describe('per-host favicon, touch icon and manifest', () => {
  it('covers all four hosts', () => { expect(HOSTS.length).toBe(4); });
  for (const [file, type] of Object.entries(ROUTES)) {
    it(`app/${file}/route.ts serves distinct ${type} bytes per host`, async () => {
      const { GET } = await import(`@/app/${file}/route`);
      const bodies = new Set<string>();
      for (const host of HOSTS) {
        const res: Response = GET(new Request(`https://${host}/${file}`, { headers: { host } }));
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe(type);
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (file === 'favicon.ico') expect([...bytes.slice(0, 4)]).toEqual([0, 0, 1, 0]);
        else expect(pngSize(bytes)).toEqual({ width: PNG_SIZES[file], height: PNG_SIZES[file] });
        bodies.add(Buffer.from(bytes).toString('base64'));
      }
      expect(bodies.size).toBe(HOSTS.length);
    });
  }
  it('site.webmanifest names the host it is served on and lists 192/512 icons', async () => {
    const { GET } = await import('@/app/site.webmanifest/route');
    const names = new Set<string>();
    for (const host of HOSTS) {
      const res: Response = GET(new Request(`https://${host}/site.webmanifest`, { headers: { host } }));
      expect(res.headers.get('content-type')).toBe('application/manifest+json');
      const m = await res.json();
      names.add(m.name);
      expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
    }
    expect(names.size).toBe(HOSTS.length);
  });
  it('the root layout links icon, apple-touch-icon and manifest on the requesting host', async () => {
    const { generateMetadata } = await import('@/app/layout');
    for (const host of HOSTS) {
      currentHost = host;
      const md = await generateMetadata();
      const icons = md.icons as { icon: Array<{ url: string }>; apple: Array<{ url: string }> };
      expect(icons.icon[0].url).toBe(`https://${host}/favicon.ico`);
      expect(icons.apple[0].url).toBe(`https://${host}/apple-touch-icon.png`);
      expect(md.manifest).toBe(`https://${host}/site.webmanifest`);
    }
  });
  it('middleware passes the icon paths through on every host', () => {
    const src = readFileSync('middleware.ts', 'utf8');
    for (const p of ['/favicon.ico', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png', '/og.png', '/site.webmanifest']) expect(src).toContain(`'${p}'`);
  });
});
