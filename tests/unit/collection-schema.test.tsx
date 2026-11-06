import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CANONICAL_HOSTS, canonicalUrl, guidesForHost } from '@/lib/site-config';
import { products, suite } from '@/lib/products';
let host = 'weddingchecklistpdf.com';
vi.mock('next/headers', () => ({ headers: async () => new Headers({ host }) }));
import GuidesIndex from '@/app/guides/page';
import ShopPage from '@/app/shop/page';
function list(html: string) {
  const nodes = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(match => JSON.parse(match[1]));
  const lists = nodes.filter(node => node['@type'] === 'ItemList');
  expect(lists).toHaveLength(1);
  expect(lists[0].numberOfItems).toBeGreaterThan(0);
  return lists[0];
}
describe('collection schema matches visible cards', () => {
  // The guide index is a main-site page since 2026-11-06 (satellites 301 /guides to it,
  // pinned in tests/unit/satellite-own-tool-only.test.ts).
  for (const domain of CANONICAL_HOSTS.filter((h) => h === 'weddingchecklistpdf.com')) it(`${domain} guide index lists its own guides in order`, async () => {
    host = domain;
    const html = renderToStaticMarkup(await GuidesIndex());
    const entries = guidesForHost(domain);
    const node = list(html);
    expect(node.url).toBe(canonicalUrl(domain, '/guides'));
    expect(node.itemListElement).toEqual(entries.map((page, index) => ({ '@type': 'ListItem', position: index + 1, name: page.title, url: canonicalUrl(domain, `/guides/${page.slug}`) })));
    for (const page of entries) expect(html).toContain(`href="/guides/${page.slug}"`);
  });
  it('the guide index is only ever the main site\'s', async () => {
    for (const domain of CANONICAL_HOSTS) {
      host = domain;
      expect(list(renderToStaticMarkup(await GuidesIndex())).url).toBe(canonicalUrl('weddingchecklistpdf.com', '/guides'));
    }
  });
  it('shop lists the four visible products and its bundle, at canonical destinations', () => {
    const html = renderToStaticMarkup(<ShopPage />);
    const node = list(html);
    expect(node.numberOfItems).toBe(products.length + 1);
    expect(node.itemListElement.map((item: {name: string; url: string}) => [item.name, item.url])).toEqual([
      ...products.map(product => [product.name, product.canonical_url]),
      [suite.name, 'https://weddingchecklistpdf.com/shop']
    ]);
    for (const product of products) expect(html).toContain(product.name);
    expect(html).toContain(suite.name);
  });
});
