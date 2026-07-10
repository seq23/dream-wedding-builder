import catalog from '@/data/products/product_catalog.json';
export type Product = (typeof catalog.products)[number];
export const products = catalog.products.filter((product): product is Product => product.id !== 'operations-suite');
export const suite = catalog.products.find(product => product.id === 'operations-suite')!;
export function productById(id: string) { return catalog.products.find(product => product.id === id); }
export function productBySku(sku: string) { return catalog.products.find(product => product.sku === sku); }
export const supportEmail = catalog.support_email;
