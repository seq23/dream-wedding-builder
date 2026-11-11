import { PRODUCTS, type Entitlement, type ProductId } from './offers';
export const STORE_STOP = 'DW_STORE_NOT_SET_UP';
export interface StoreProduct { id: ProductId; price: string }
/** Only actual catalog entries with a one-time, positive store price can be sold. */
export function storeProduct(product: { identifier: string; subscriptionPeriod: string | null; priceString: string; price: number }): StoreProduct | null {
  if (!Object.hasOwn(PRODUCTS, product.identifier) || product.subscriptionPeriod !== null || !product.priceString.trim() || !Number.isFinite(product.price) || product.price <= 0) return null;
  return { id: product.identifier as ProductId, price: product.priceString };
}
export interface PurchaseSnapshot { userId: string; active: Entitlement[] }
export interface PurchasesProvider {
  readonly available: boolean;
  products(offering: string): Promise<StoreProduct[]>;
  purchase(id: ProductId): Promise<PurchaseSnapshot>;
  restore(): Promise<PurchaseSnapshot>;
}
/** No simulated sale or entitlement when stores are absent, including the web preview. */
export class DisabledPurchases implements PurchasesProvider {
  readonly available = false;
  async products(): Promise<StoreProduct[]> { return []; }
  async purchase(_id: ProductId): Promise<PurchaseSnapshot> { throw new Error(STORE_STOP); }
  async restore(): Promise<PurchaseSnapshot> { throw new Error(STORE_STOP); }
}
export function acceptedKey(os: string, key?: string): boolean {
  return !!key && ((os === 'ios' && key.startsWith('appl_')) || (os === 'android' && key.startsWith('goog_')));
}
