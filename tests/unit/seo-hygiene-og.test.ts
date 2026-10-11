// Guard: every page's og:image is its own host's 1200x630 /og.png with width/height,
// plus twitter:image. Origin (2026-10-11): weddingchecklistpdf.com's homepage set its
// own openGraph without images (Next replaces the layout's openGraph wholesale), so
// it had no og:image while the three hub homepages did.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { HOSTS, pngSize } from './helpers/site-homes';
import { seoMetadata } from '@/lib/seo';

let currentHost = 'weddingchecklistpdf.com';
vi.mock('next/headers', () => ({ headers: async () => new Headers({ host: currentHost }) }));

type Og = { images: Array<{ url: string; width: number; height: number }> };
function expectOg(md: { openGraph?: unknown; twitter?: unknown }, host: string) {
  const img = (md.openGraph as Og).images[0];
  expect(img).toMatchObject({ url: `https://${host}/og.png`, width: 1200, height: 630 });
  expect((md.twitter as { images: string[] }).images[0]).toBe(`https://${host}/og.png`);
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
}

describe('og:image on every page', () => {
  it('covers all four hosts', () => { expect(HOSTS.length).toBe(4); });
  it('app/og.png serves a distinct 1200x630 PNG per host', async () => {
    const { GET } = await import('@/app/og.png/route');
    const seen = new Set<string>();
    for (const host of HOSTS) {
      const res: Response = GET(new Request(`https://${host}/og.png`, { headers: { host } }));
      const bytes = new Uint8Array(await res.arrayBuffer());
      expect(pngSize(bytes)).toEqual({ width: 1200, height: 630 });
      seen.add(Buffer.from(bytes).toString('base64'));
    }
    expect(seen.size).toBe(HOSTS.length);
  });
  it('the layout default (pages without their own openGraph) uses the host og.png', async () => {
    const { generateMetadata } = await import('@/app/layout');
    for (const host of HOSTS) { currentHost = host; expectOg(await generateMetadata(), host); }
  });
  it('seoMetadata (hubs, guides, products) uses the host og.png', () => {
    for (const host of HOSTS) expectOg(seoMetadata({ title: 't', description: 'd', host, path: '/x' }), host);
  });
  it('weddingchecklistpdf.com homepage uses its og.png', async () => {
    const { metadata } = await import('@/app/page');
    expectOg(metadata, 'weddingchecklistpdf.com');
  });
  it('no page declares an openGraph block outside the two helpers above', () => {
    const offenders = walk('app').filter((f) => /\.(tsx?|mts)$/.test(f) && /openGraph\s*:/.test(readFileSync(f, 'utf8')) && f !== join('app', 'page.tsx') && f !== join('app', 'layout.tsx'));
    expect(offenders).toEqual([]);
    expect(readFileSync('app/page.tsx', 'utf8')).toMatch(/openGraph:[^\n]*images: ogImages\(/);
  });
});
