// The three $9 book kits are built but not on sale until their Stripe prices exist (owner, 8 Nov 2026).
// While a kit is off sale it is unlisted (no page, no checkout, no companion button); the day on_sale flips,
// its book's companion page leads with it and keeps the old product second.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bookKits, companionCtas, kitOnSale } from '@/lib/book-kits';
import { productBySku } from '@/lib/products';
import { priceEnvKeyForProduct } from '@/lib/checkout-contract';
import hubs from '@/data/seo/hub_pages.json';

const page = (hubs as any).pages['amazon/wedding-vows'];

describe('book kits and their price gate', () => {
  it('there are three kits, each with its PDF committed and its R2 object recorded', () => {
    expect(bookKits.map((k) => k.id).sort()).toEqual(['courthouse-wedding-kit', 'maid-of-honor-kit', 'wedding-vows-workbook']);
    for (const kit of bookKits) {
      expect(fs.existsSync(`product-builds/releases/${kit.release.pdf}`), kit.release.pdf).toBe(true);
      expect(kit.release.r2_key).toBe(`products/${kit.id}/current.zip`);
      expect(kit.price).toBe(9);
    }
  });
  it('off sale: the companion page keeps its current button only', () => {
    const off = bookKits.map((k) => ({ ...k, on_sale: false }));
    expect(companionCtas(page, off as any)).toEqual([page.book_cta]);
  });
  it('on sale today: checkout knows each kit SKU at $9 and its price env key is the one the Worker holds', () => {
    for (const kit of bookKits) {
      expect(kitOnSale(kit), kit.id).toBe(true);
      const product = productBySku(kit.sku);
      expect(product?.price, kit.sku).toBe(9);
      expect(priceEnvKeyForProduct(kit.id)).toBe(kit.price_env_key);
    }
  });
  it('once on sale: the kit leads and the old product is second', () => {
    const live = bookKits.map((k) => (k.id === 'wedding-vows-workbook' ? { ...k, on_sale: true } : k));
    expect(companionCtas(page, live as any)).toEqual([
      { label: 'Get the Wedding Vows Workbook — $9 ›', href: '/products/wedding-vows-workbook' },
      page.book_cta,
    ]);
  });
  it('an off-sale kit is unlisted: its product route renders only kits that are on sale', () => {
    const src = fs.readFileSync('app/products/[slug]/page.tsx', 'utf8');
    expect(src).toContain('bookKits.filter(kitOnSale)');
    expect(src).toMatch(/if \(kit && kitOnSale\(kit\)\) return <BookKitPage/);
  });
});
