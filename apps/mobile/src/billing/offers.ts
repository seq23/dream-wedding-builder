// Which products a couple is offered, from what they already own. Prices approved
// 6 Nov 2026 (docs/APP_PLAN.md, task 8); every product stays switched off until the
// store accounts and RevenueCat exist (NAMED STOP [DW_STORE_NOT_SET_UP]). The one rule
// here: nobody is ever offered something that charges twice for what they already have.
import { fullPlanSummary } from '../sharingSwitch';
export type Entitlement = 'full_plan' | 'printables' | 'day_of_kit';
export type ProductId = 'dw_full_plan' | 'dw_planner_printables' | 'dw_printables_topup' | 'dw_day_of_kit' | 'dw_new_event';

export const PRODUCTS: Record<ProductId, { priceUsd: number; grants: Entitlement[] }> = {
  dw_full_plan: { priceUsd: 14.99, grants: ['full_plan'] }, // $9.99 for the first 30 days by a scheduled store price change
  dw_planner_printables: { priceUsd: 34.99, grants: ['full_plan', 'printables', 'day_of_kit'] },
  dw_printables_topup: { priceUsd: 19.99, grants: ['printables'] },
  dw_new_event: { priceUsd: 14.99, grants: ['full_plan'] },
  dw_day_of_kit: { priceUsd: 9.99, grants: ['day_of_kit'] },
};

/** What each one is, on the buy screen. "Printables" is never left unexplained. */
export const OFFER_DETAIL: Record<ProductId, string> = {
  dw_full_plan: fullPlanSummary().offer,
  dw_planner_printables: 'The full plan, plus printables: files to print or fill in (checklist PDF, budget spreadsheet, seating chart maker, timeline template, venue comparison, vendor and payment trackers), and the day-of kit, in one payment.',
  dw_printables_topup: 'Files to print or fill in: checklist PDF, budget spreadsheet, seating chart maker, timeline template, venue comparison, vendor and payment trackers.',
  dw_day_of_kit: 'For the day itself: the run sheet, a contact list and day-of checklists, to print or fill in.',
  dw_new_event: 'One new event, paid once.',
};
/**
 * The bundle nudge: a small tag over the bundle card, never a pre-selection and never a
 * countdown (launch kit, 21 Nov 2026; the tag-over-the-bigger-plan shape is the common one in
 * shipped one-time-purchase paywalls). It claims no saving: bought in steps (full plan, then the
 * top-up) the same things cost about the same, so the tag says only what is true, all at once.
 */
export const OFFER_TAG: Partial<Record<ProductId, string>> = { dw_planner_printables: 'Everything, one payment' };
/** The buy screen's opening line, true for every couple who sees it (owners see the extras below it): what she pays for, and what she never pays for. */
export const PRICE_PROMISE = 'The full plan is paid once for this wedding. No subscription and no trial clock. Your free plan stays free, and moving your date never costs anything.';
/** Nothing is chosen for her: only a new event, the one thing that screen sells, starts selected. */
export function initialChoice(offers: ProductId[]): ProductId | undefined {
  return offers.length === 1 && offers[0] === 'dw_new_event' ? offers[0] : undefined;
}
/** The buy button names what she chose and what it costs. */
export function buyLabel(name: string, price: string | undefined): string {
  return price ? `Get ${name} · ${price} ›` : `Get ${name} ›`;
}

/**
 * The one buy button's words. While the store's payment sheet is open the
 * chosen offer shows busy; "Choose one above" only when nothing is chosen.
 */
export function buyButtonLabel(s: {
  available: boolean; preview: boolean; selected?: ProductId; name: string; price?: string;
  buying: boolean; storeName: string;
}): string {
  if (!s.available) return s.preview ? 'Buying is off in this preview' : 'The store is not answering';
  if (!s.selected) return 'Choose one above';
  if (s.selected === 'dw_new_event') return s.buying ? 'Starting your new event…' : 'Start my new event ›';
  if (s.buying) return `Opening the ${s.storeName}…`;
  return buyLabel(s.name, s.price);
}

/** In display order: the full plan first, the bundle after it. */
export function offersFor(owned: Iterable<Entitlement>, newPaidEvent = false): ProductId[] {
  if (newPaidEvent) return ['dw_new_event'];
  const has = new Set(owned);
  // The printables already hold the timeline pages the Day-of kit sells.
  if (has.has('printables')) return [];
  // Owners of the full plan get the top-up (same total as the bundle), never the bundle.
  if (has.has('full_plan')) return has.has('day_of_kit') ? ['dw_printables_topup'] : ['dw_printables_topup', 'dw_day_of_kit'];
  return ['dw_full_plan', 'dw_planner_printables'];
}
