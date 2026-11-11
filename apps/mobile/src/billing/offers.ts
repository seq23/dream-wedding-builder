// Which products a couple is offered, from what they already own. Prices approved
// 6 Nov 2026 (docs/APP_PLAN.md, task 8); every product stays switched off until the
// store accounts and RevenueCat exist (NAMED STOP [DW_STORE_NOT_SET_UP]). The one rule
// here: nobody is ever offered something that charges twice for what they already have.
export type Entitlement = 'full_plan' | 'printables' | 'day_of_kit';
export type ProductId = 'dw_full_plan' | 'dw_planner_printables' | 'dw_printables_topup' | 'dw_day_of_kit' | 'dw_new_event';

export const PRODUCTS: Record<ProductId, { priceUsd: number; grants: Entitlement[] }> = {
  dw_full_plan: { priceUsd: 14.99, grants: ['full_plan'] }, // $9.99 for the first 30 days by a scheduled store price change
  dw_planner_printables: { priceUsd: 34.99, grants: ['full_plan', 'printables', 'day_of_kit'] },
  dw_printables_topup: { priceUsd: 19.99, grants: ['printables'] },
  dw_new_event: { priceUsd: 14.99, grants: ['full_plan'] },
  dw_day_of_kit: { priceUsd: 9.99, grants: ['day_of_kit'] },
};

/** In display order: the first one is the better-value choice. */
export function offersFor(owned: Iterable<Entitlement>): ProductId[] {
  const has = new Set(owned);
  // The printables already hold the timeline pages the Day-of kit sells.
  if (has.has('printables')) return [];
  // Owners of the full plan get the top-up (same total as the bundle), never the bundle.
  if (has.has('full_plan')) return has.has('day_of_kit') ? ['dw_printables_topup'] : ['dw_printables_topup', 'dw_day_of_kit'];
  return ['dw_planner_printables', 'dw_full_plan'];
}
