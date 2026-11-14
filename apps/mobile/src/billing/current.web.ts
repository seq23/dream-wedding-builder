import { DisabledPurchases } from './provider';
// The web preview never sells: no store exists in a browser.
export const purchases = new DisabledPurchases();
