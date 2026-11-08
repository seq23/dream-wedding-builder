import data from '@/data/products/book_kits.json';

// The three $9 Kindle-book kits (data/products/book_kits.json). A kit is sold only when on_sale is
// true, which happens after its Stripe price exists and its row joins product_catalog.json. Until
// then nothing links to it, checkout does not know its SKU, and its page says it is coming soon.
export type BookKit = (typeof data.kits)[number];
export const bookKits: BookKit[] = data.kits;
export const bookKitById = (id?: string) => bookKits.find((kit) => kit.id === id);
export const kitOnSale = (kit?: BookKit) => Boolean(kit && kit.on_sale === true);

/** A Kindle companion's buttons, in order: the book's own kit once it is on sale, then the page's existing product. */
export function companionCtas(page: { book_cta?: { label: string; href: string }; book_kit?: string }, kits: BookKit[] = bookKits) {
  if (!page.book_cta) return [];
  const kit = kits.find((k) => k.id === page.book_kit);
  const kitCta = kit && kitOnSale(kit) ? [{ label: `Get ${kit.name.replace(/^The /, 'the ')} — $${kit.price} ›`, href: kit.route }] : [];
  return [...kitCta, page.book_cta];
}
