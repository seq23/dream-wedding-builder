import { PRODUCTS } from './billing/offers';
/** True only in the free web preview she clicks through; never in a store build
 * (scripts/release-gate.mjs stops a store build that carries the flag). */
export const PREVIEW = process.env.EXPO_PUBLIC_DW_PREVIEW === '1';
/** Shown only in the preview, wherever buying would be. */
export const PREVIEW_NOTE = 'This is a preview of the app, so buying is switched off.';
/** What a customer reads if the store cannot be reached. */
export const STORE_AWAY = 'The store is not answering right now. Please try again in a little while.';

/** The full plan's price as a person reads it: the store's own price when it is loaded;
 * in the preview, the list price; otherwise nothing rather than a guess. */
export function fullPlanPrice(storePrice: string | undefined, preview: boolean): string {
  return storePrice?.trim() || (preview ? `$${PRODUCTS.dw_full_plan.priceUsd.toFixed(2)}` : '');
}
/** One line for every paid screen and locked row, so the paid part always carries its name and price. */
export function partOfFullPlan(price: string, start: 'Part' | 'part' = 'Part'): string {
  return price ? `${start} of the full plan · ${price}, paid once` : `${start} of the full plan · paid once`;
}
