// Guard: every indexable route carries a complete structured-data frame.
//
// Origin (Search Readiness audit, 2026-10-25, items c1/c2/c3/c5 on
// weddingchecklistpdf.com): the Organization node on every page lacked sameAs and
// five page kinds emitted their own publisher stub with no logo either; /guides,
// /photos and /trends had no WebPage and no BreadcrumbList because they emitted no
// JSON-LD at all; and no sampled page carried a priced Offer although all four
// homepages print a price in their own text.
//
// The frame now comes from app/layout.tsx for every page, so what has to be
// guarded is the thing that made the old arrangement fail: a route whose name
// nothing in this repo knows, which would frame the page as the site itself.
import { describe, expect, it } from 'vitest';
import ownership from '@/data/seo/route_ownership.json';
import { breadcrumbTrail, pageNameFor } from '@/lib/page-frame';
import { canonicalUrl, PARENT_HOST, productForHost, type SiteHost } from '@/lib/site-config';
import { breadcrumbListNode, organizationNode, pageFrameNodes, productNode, webPageNode } from '@/lib/site-home';

const HOSTS = Object.keys(ownership.hosts) as SiteHost[];
const indexableRoutes = ownership.routes.filter((route) => route.indexable);
const sharedRoutes = ownership.shared_host_routes.filter((path) => path === '/guides');

describe('the Organization node', () => {
  const org = organizationNode();
  it('carries name, url, logo and sameAs', () => {
    for (const key of ['name', 'url', 'logo', 'sameAs']) expect(org[key], key).toBeTruthy();
    expect(Array.isArray(org.sameAs) && (org.sameAs as unknown[]).length).toBeGreaterThan(0);
  });
  it('lists only absolute https profiles in sameAs', () => {
    for (const profile of org.sameAs as string[]) expect(profile).toMatch(/^https:\/\/[^\s"]+$/);
  });
  it('is the same entity everywhere, by @id', () => {
    expect(org['@id']).toBe(`${org.url}#organization`);
  });
});

describe('every indexable route has a name and a trail', () => {
  it('has routes to check', () => { expect(indexableRoutes.length).toBeGreaterThan(100); });
  for (const route of [...indexableRoutes, ...sharedRoutes.map((path) => ({ path, host: PARENT_HOST }))]) {
    it(`${route.path} is named by a record in this repo`, () => {
      // '/' is the site itself; every other route must be named by a hub record, a
      // landing record, the content registry, the product catalog or a label table.
      if (route.path === '/') return;
      expect(pageNameFor(route.path), route.path).toBeTruthy();
    });
  }
});

describe('the frame each page carries', () => {
  for (const host of HOSTS) {
    it(`${host}: the WebPage and the trail describe the page that was asked for`, () => {
      const path = '/guides';
      const name = pageNameFor(path)!;
      const nodes = pageFrameNodes({ host, path, name, description: 'x'.repeat(130), breadcrumbs: breadcrumbTrail(host, path, name) });
      expect(nodes.map((node) => node['@type'])).toEqual(['Organization', 'WebPage', 'BreadcrumbList']);
      const page = webPageNode({ host, path, name, description: 'x'.repeat(130) });
      expect(page['@id']).toBe(`${canonicalUrl(host, path)}#webpage`);
      expect(page.url).toBe(canonicalUrl(host, path));
      const crumbs = breadcrumbTrail(host, path, name);
      expect(crumbs.length).toBeGreaterThan(1);
      expect(crumbs[crumbs.length - 1].name).toBe(name);
      const list = breadcrumbListNode(crumbs) as { itemListElement: Array<{ position: number; item: string }> };
      expect(list.itemListElement.map((item) => item.position)).toEqual(crumbs.map((_, index) => index + 1));
      for (const item of list.itemListElement) expect(item.item).toMatch(/^https:\/\//);
    });
    it(`${host}: a nested path keeps its section hop`, () => {
      const crumbs = breadcrumbTrail(host, '/guides/wedding-week-checklist');
      expect(crumbs.map((crumb) => crumb.name)).toContain(pageNameFor('/guides'));
    });
    it(`${host}: the homepage trail is the site alone`, () => {
      const cfg = (ownership.hosts as Record<string, { root_target: string }>)[host];
      expect(breadcrumbTrail(host, cfg.root_target)).toHaveLength(1);
    });
  }
});

describe('the priced Offer', () => {
  for (const host of HOSTS) {
    it(`${host} offers its product at the catalog price`, () => {
      const product = productForHost(host)!;
      const node = productNode(host) as { offers: { price: string; priceCurrency: string; url: string } };
      expect(node).toBeTruthy();
      // The price in schema is the catalog price, which is the same number the page
      // prints and the checkout charges. A schema price the page does not show is
      // what the checklist's c5 treats as deceptive markup.
      expect(node.offers.price).toBe(String(product.price));
      expect(node.offers.priceCurrency).toBe('USD');
      expect(node.offers.url).toBe(canonicalUrl(host, product.route));
    });
  }
});
