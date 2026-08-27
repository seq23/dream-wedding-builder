import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GET as sitemap } from '@/app/sitemap.xml/route';
import { GET as llms } from '@/app/llms.txt/route';
import hubs from '@/data/seo/hub_pages.json';
import catalog from '@/data/products/product_catalog.json';
import { isShippingSlug, shippingPages } from '@/lib/authority-registry';
import { CANONICAL_HOSTS } from '@/lib/site-config';

const repoRoot = path.resolve(__dirname, '../..');
const productIds = new Set(catalog.products.map((product) => product.id));
const hubSlugs = new Set(Object.keys(hubs.pages));

async function locsFor(host: string): Promise<string[]> {
  const response = await sitemap(new Request(`https://${host}/sitemap.xml`, { headers: { host } }));
  expect(response.status).toBe(200);
  const xml = await response.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

/**
 * Resolves a site-relative path to the thing that renders it, mirroring the App
 * Router's own resolution order. Returns null when nothing would render, which is
 * exactly the condition that produced the eight live 404s.
 */
function resolves(pathname: string): boolean {
  const guide = pathname.match(/^\/guides\/([^/]+)$/);
  if (guide) return isShippingSlug(guide[1]);
  if (pathname === '/guides') return true;
  const product = pathname.match(/^\/products\/([^/]+)$/);
  // /products/[slug] renders catalog members; /products/operations-suite is a
  // static route of its own.
  if (product) return productIds.has(product[1]) || fs.existsSync(path.join(repoRoot, 'app', pathname.slice(1), 'page.tsx'));
  const slug = pathname.replace(/^\//, '');
  if (hubSlugs.has(slug)) return true;
  if (pathname === '/') return fs.existsSync(path.join(repoRoot, 'app/page.tsx'));
  return fs.existsSync(path.join(repoRoot, 'app', slug, 'page.tsx'));
}

describe('sitemap publishes only URLs that render', () => {
  it('emits at least one URL per canonical host', async () => {
    for (const host of CANONICAL_HOSTS) expect((await locsFor(host)).length).toBeGreaterThan(0);
  });

  it('never publishes a guide the router would notFound()', async () => {
    const broken: string[] = [];
    for (const host of CANONICAL_HOSTS) {
      for (const loc of await locsFor(host)) {
        const { pathname } = new URL(loc);
        if (!resolves(pathname)) broken.push(loc);
      }
    }
    expect(broken).toEqual([]);
  });

  it('publishes every renderable guide on its owning host', async () => {
    const published = new Set<string>();
    for (const host of CANONICAL_HOSTS) {
      for (const loc of await locsFor(host)) {
        const guide = new URL(loc).pathname.match(/^\/guides\/([^/]+)$/);
        if (guide) published.add(guide[1]);
      }
    }
    // operations-suite has no domain, so its pages have no sitemap to appear in.
    const expected = shippingPages.filter((page) => page.product_id !== 'operations-suite').map((page) => page.slug);
    expect([...expected].filter((slug) => !published.has(slug))).toEqual([]);
  });

  it('keeps llms.txt to the same renderable set', async () => {
    const broken: string[] = [];
    for (const host of CANONICAL_HOSTS) {
      const response = await llms(new Request(`https://${host}/llms.txt`, { headers: { host } }));
      const body = await response.text();
      for (const match of body.matchAll(/\]\((https:\/\/[^)]+)\)/g)) {
        const { pathname } = new URL(match[1]);
        if (pathname !== '/sitemap.xml' && !resolves(pathname)) broken.push(match[1]);
      }
    }
    expect(broken).toEqual([]);
  });
});
