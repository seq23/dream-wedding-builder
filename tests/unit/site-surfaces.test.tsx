import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Compare from '@/app/shop/compare/page';
import { products, suite } from '@/lib/products';

// Hostile review, 10 Nov 2026: on a phone the compare table was 555 px wide in a 390 px
// screen, so the price and the buy button were off-screen. Each product is now its own
// card carrying its price and its own buy button, with no table to swipe.
describe('compare page on a phone', () => {
  it('gives every product a card with its price and its own buy button, and no table', () => {
    const html = renderToStaticMarkup(<Compare />);
    expect(html).not.toContain('<table');
    const cards = html.split('<article').slice(1);
    expect(cards.length).toBe(products.length);
    expect(products.length).toBeGreaterThan(0);
    for (const product of products) {
      const card = cards.find(c => c.includes(product.name));
      expect(card, product.name).toBeTruthy();
      expect(card).toContain(`$${product.price}`);
      expect(card).toContain(`name="sku" value="${product.sku}"`);
    }
    // The $39 offer is sold under its one catalog name.
    expect(html).toContain(`Get the ${suite.name} — $`);
  });
});
