// Guard: weddingchecklistpdf.com's Pinterest domain claim and its RSS pin feed
// (owner-approved 16 Oct 2026). The built-site half (meta tag in the rendered <head>,
// every feed URL answering 200) is scripts/validators/validate_pinterest.mjs.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import ownership from '@/data/seo/route_ownership.json';
import { queue } from '@/lib/pinfeed';

const HOST = 'weddingchecklistpdf.com';
const TOKEN = '0fcfdee391238788157a7120c048a945';

type FeedItem = { title: string; link: string; description: string; pubDate: string; enclosure: Record<string, string> | null; media: Record<string, string> | null };
export function parseFeed(xml: string): { items: FeedItem[] } {
  return JSON.parse(execFileSync('python3', ['-I', 'scripts/pinterest/parse_feed.py'], { input: xml }).toString());
}

async function fetchFeed(path: string, host: string): Promise<Response> {
  const mod = path === '/pinfeed' ? await import('@/app/pinfeed/route') : await import('@/app/pinfeed.xml/route');
  return mod.GET(new Request(`https://${host}${path}`, { headers: { host } }));
}

describe('Pinterest domain claim', () => {
  it('the weddingchecklistpdf.com homepage declares p:domain_verify', async () => {
    const { metadata } = await import('@/app/page');
    expect((metadata.other as Record<string, string>)['p:domain_verify']).toBe(TOKEN);
  });
});

describe('Pinterest feed /pinfeed.xml', () => {
  it('serves RSS 2.0 with application/rss+xml on both URLs', async () => {
    for (const path of ['/pinfeed.xml', '/pinfeed']) {
      const res = await fetchFeed(path, HOST);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/^application\/rss\+xml/);
      expect(parseFeed(await res.text()).items.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('is not published on the sibling hosts', async () => {
    for (const host of Object.keys(ownership.hosts).filter((h) => h !== HOST)) {
      expect((await fetchFeed('/pinfeed.xml', host)).status).toBe(404);
    }
  });

  it('every item links a real page on this host with the utm params, never checkout, with a real 1000x1500 image', async () => {
    const { items } = parseFeed(await (await fetchFeed('/pinfeed.xml', HOST)).text());
    const owned = new Set(ownership.routes.filter((r) => r.host === HOST).map((r) => r.path));
    expect(items.length).toBeGreaterThanOrEqual(5);
    for (const item of items) {
      expect(item.title.length, item.title).toBeLessThanOrEqual(100);
      expect(item.description.length, item.title).toBeLessThanOrEqual(500);
      expect(Number.isNaN(Date.parse(item.pubDate)), item.pubDate).toBe(false);
      const link = new URL(item.link);
      expect(link.host).toBe(HOST);
      expect(owned.has(link.pathname), link.pathname).toBe(true);
      expect(link.pathname).not.toMatch(/checkout|order|api|stripe/i);
      // Launch items carry exactly the three pinfeed params; daily-drip items add
      // utm_content=<variant id> for a variant of this very page (tests/unit/pinqueue.test.ts).
      const params = Object.fromEntries(link.searchParams);
      const base = { utm_source: 'pinterest', utm_medium: 'organic', utm_campaign: 'pinfeed' };
      if ('utm_content' in params) {
        expect(queue.variants.find((v) => v.id === params.utm_content)?.path, params.utm_content).toBe(link.pathname);
        expect(params).toEqual({ ...base, utm_content: params.utm_content });
      } else expect(params).toEqual(base);
      const enc = item.enclosure!;
      expect(item.media?.url).toBe(enc.url);
      const img = new URL(enc.url);
      expect(img.host).toBe(HOST);
      const file = join('public', img.pathname);
      expect(existsSync(file), file).toBe(true);
      expect(Number(enc.length)).toBe(statSync(file).size);
      const meta = await sharp(readFileSync(file)).metadata();
      expect({ w: meta.width, h: meta.height, type: `image/${meta.format}` }).toEqual({ w: 1000, h: 1500, type: enc.type });
    }
  });
});
