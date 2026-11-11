import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';
import { type Entitlement, type ProductId } from './offers';
import { storeProduct, type PurchasesProvider, type PurchaseSnapshot, type StoreProduct } from './provider';
const snapshot = (info: CustomerInfo, userId: string): PurchaseSnapshot => ({
  userId, active: (['full_plan', 'printables', 'day_of_kit'] as Entitlement[]).filter(id => !!info.entitlements.active[id]),
});
/** Native adapter only. Do not instantiate until the server verification door is ready. */
export class RevenueCat implements PurchasesProvider {
  readonly available = true;
  private packages = new Map<ProductId, PurchasesPackage>();
  constructor(key: string) {
    Purchases.configure({ apiKey: key, diagnosticsEnabled: false, automaticDeviceIdentifierCollectionEnabled: false });
  }
  async products(offering: string): Promise<StoreProduct[]> {
    this.packages.clear();
    const result: StoreProduct[] = [];
    const selected = (await Purchases.getOfferings()).all[offering];
    for (const pkg of selected?.availablePackages ?? []) {
      const p = pkg.product;
      const product = storeProduct(p);
      if (!product) continue;
      this.packages.set(product.id, pkg);
      result.push(product);
    }
    return result;
  }
  async purchase(id: ProductId) {
    const pkg = this.packages.get(id);
    if (!pkg) throw new Error('STORE_PRODUCT_UNAVAILABLE');
    const result = await Purchases.purchasePackage(pkg);
    return snapshot(result.customerInfo, await Purchases.getAppUserID());
  }
  async restore() { return snapshot(await Purchases.restorePurchases(), await Purchases.getAppUserID()); }
}
