import catalog from '@/data/products/product_catalog.json';

export type ProductPreview = { src: string; title: string; caption: string; alt: string };
export type ProductInventory = { pdf: string; workbook: string; sheets: string[]; formula_count: number; extra: string[] };

export type PaidProduct = {
  id: string;
  sku: string;
  name: string;
  domain: string;
  price: number;
  route: string;
  headline: string;
  sub: string;
  features: string[];
  keywords: string[];
  eyebrow: string;
  promise: string;
  audience: string[];
  outcomes: string[];
  process: string[];
  objections: string[][];
  image: string;
  hero_image: string;
  cta: string;
  value_note: string;
  gallery: ProductPreview[];
  canonical_url: string;
  inventory: ProductInventory;
  preview_note: string;
};

export type SuiteProduct = {
  id: 'operations-suite';
  sku: string;
  name: string;
  price: number;
  route: string;
  features: string[];
  image: string;
  standalone_value: number;
  savings: number;
  cta: string;
};

export type Product = PaidProduct;
export type GovernedProduct = PaidProduct | SuiteProduct;

// Paid tools with the full product template. Kindle-book kits (kind "book_kit", data/products/book_kits.json)
// are sold through the same checkout but render their own page, so they are listed separately.
export const products = catalog.products
  .filter((product) => product.id !== 'operations-suite' && (product as { kind?: string }).kind !== 'book_kit') as unknown as PaidProduct[];

export const bookKitProducts = catalog.products
  .filter((product) => (product as { kind?: string }).kind === 'book_kit') as unknown as GovernedProduct[];

export const suite = catalog.products.find(
  (product) => product.id === 'operations-suite'
) as unknown as SuiteProduct;

const governedProducts: GovernedProduct[] = [...products, suite, ...bookKitProducts];

export function productById(id: string): GovernedProduct | undefined {
  return governedProducts.find((product) => product.id === id);
}

export function productBySku(sku: string): GovernedProduct | undefined {
  return governedProducts.find((product) => product.sku === sku);
}

export const supportEmail = catalog.support_email;
