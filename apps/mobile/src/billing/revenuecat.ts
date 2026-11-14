import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';
import { type Entitlement, type ProductId } from './offers';
import { storeProduct, type PurchasesProvider, type PurchaseSnapshot, type StoreProduct } from './provider';
export const PURCHASE_CANCELLED = 'Purchase cancelled. You have not been charged.';
const snapshot = (info: CustomerInfo, userId: string): PurchaseSnapshot => ({
  userId, active: (['full_plan', 'printables', 'day_of_kit'] as Entitlement[]).filter(id => !!info.entitlements.active[id]),
});
/** Native adapter. `active` is the SDK's claim only: checkout ignores it and unlocks
 * nothing until the server door (/api/app-unlock) has verified the purchase and
 * delivered the content (docs/APP_UNLOCK.md). */
export class RevenueCat implements PurchasesProvider {
  readonly available = true;
  // Keyed by store product: several screens read different offerings at once, and a
  // product bought from any of them is the same store product.
  private packages = new Map<ProductId, PurchasesPackage>();
  constructor(key: string) {
    // Anonymous IDs only: the door accepts only $RCAnonymousID, never a custom ID.
    Purchases.configure({ apiKey: key, diagnosticsEnabled: false, automaticDeviceIdentifierCollectionEnabled: false });
  }
  private read(packages: PurchasesPackage[]): StoreProduct[] {
    const result: StoreProduct[] = [];
    for (const pkg of packages) {
      const product = storeProduct(pkg.product);
      if (!product) continue;
      this.packages.set(product.id, pkg);
      result.push(product);
    }
    return result;
  }
  async products(offering: string): Promise<StoreProduct[]> {
    return this.read((await Purchases.getOfferings()).all[offering]?.availablePackages ?? []);
  }
  async purchase(id: ProductId) {
    if (!this.packages.has(id)) this.read(Object.values((await Purchases.getOfferings()).all).flatMap(o => o.availablePackages));
    const pkg = this.packages.get(id);
    if (!pkg) throw new Error('This product is not available in the store right now. Please try again in a little while.');
    try {
      const result = await Purchases.purchasePackage(pkg);
      return snapshot(result.customerInfo, await Purchases.getAppUserID());
    } catch (e) {
      if ((e as { userCancelled?: boolean } | null)?.userCancelled) throw new Error(PURCHASE_CANCELLED);
      throw e;
    }
  }
  async restore() { return snapshot(await Purchases.restorePurchases(), await Purchases.getAppUserID()); }
}
