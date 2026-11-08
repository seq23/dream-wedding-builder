// A Kindle companion's paid button (owner, 8 Nov 2026) names a real product at its catalog price
// and links to that product's page; the template renders it after the quick answer and at the end.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import hubs from '@/data/seo/hub_pages.json';
import catalog from '@/data/products/product_catalog.json';

const pages = Object.entries((hubs as any).pages as Record<string, any>).filter(([, p]) => p.book_cta);

describe('Kindle companion buy buttons', () => {
  it('the three 8 Nov books carry one', () => {
    expect(pages.map(([slug]) => slug).sort()).toEqual(['amazon/courthouse-wedding-planner', 'amazon/maid-of-honor-handbook', 'amazon/wedding-vows']);
  });
  for (const [slug, page] of pages) {
    it(`${slug} names a real product at its catalog price`, () => {
      const id = String(page.book_cta.href).replace(/^\/products\//, '');
      const product = (catalog as any).products.find((p: any) => p.id === id);
      expect(product, page.book_cta.href).toBeTruthy();
      expect(page.book_cta.label).toContain(product.name);
      expect(page.book_cta.label).toContain(`$${product.price} `);
    });
  }
  it('the template renders it right after the opening definition and again at the end', () => {
    const tpl = fs.readFileSync('components/seo/HubPage.tsx', 'utf8');
    const top = tpl.indexOf('data-book-cta="top"'), end = tpl.indexOf('data-book-cta="end"');
    // In the header, right after the opening definition: the first phone screen, before the quick answer.
    expect(top).toBeGreaterThan(tpl.indexOf('className="definition'));
    expect(top).toBeLessThan(tpl.indexOf('Quick answer'));
    expect(end).toBeGreaterThan(tpl.indexOf('guide-faq'));
  });
});
