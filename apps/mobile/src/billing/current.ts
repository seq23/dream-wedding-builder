import { DisabledPurchases } from './provider';
// Deliberately closed even if someone supplies a public SDK key. Client purchase
// metadata is not proof: app-unlock must verify it server-side before activation.
export const purchases = new DisabledPurchases();
