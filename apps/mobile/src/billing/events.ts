import { parseDay } from '@core/dated-plan';
import type { Entitlement, ProductId } from './offers';
export interface PaidEvent { id: string; name: string; date: string; dateChanges: number; fullPlan: boolean }
export interface EventLedger { firstEventId: string | null; events: PaidEvent[]; extras: Entitlement[]; purchasedExtras?: Entitlement[] }
export const emptyLedger = (): EventLedger => ({ firstEventId: null, events: [], extras: [] });
export function addEvent(ledger: EventLedger, id: string, name: string, date: string): EventLedger {
  if (!id || !name.trim() || !parseDay(date) || ledger.events.some(e => e.id === id)) throw new Error('INVALID_EVENT');
  return { ...ledger, events: [...ledger.events, { id, name: name.trim().slice(0, 140), date, dateChanges: 0, fullPlan: false }] };
}
export function renameEvent(event: PaidEvent, name: string): PaidEvent {
  if (event.fullPlan) throw new Error('EVENT_NAME_LOCKED');
  if (!name.trim()) throw new Error('INVALID_EVENT');
  return { ...event, name: name.trim().slice(0, 140) };
}
export function moveEvent(event: PaidEvent, date: string): PaidEvent {
  if (!parseDay(date)) throw new Error('INVALID_DATE');
  if (date === event.date) return event;
  if (event.fullPlan && event.dateChanges >= 3) throw new Error('NEW_EVENT_REQUIRED');
  return { ...event, date, dateChanges: event.dateChanges + (event.fullPlan ? 1 : 0) };
}
/** Only call with the server-verified event binding, never SDK/local receipt metadata.
 * These reducers are not an authorization boundary or currently wired to the app. */
export function recordVerifiedPurchase(ledger: EventLedger, eventId: string, product: ProductId): EventLedger {
  const event = ledger.events.find(e => e.id === eventId);
  if (!event) throw new Error('EVENT_NOT_FOUND');
  const unlock = ['dw_full_plan', 'dw_planner_printables', 'dw_new_event'].includes(product);
  if (unlock && event.fullPlan) throw new Error('EVENT_ALREADY_PAID');
  if (unlock && product !== 'dw_new_event' && ledger.firstEventId && ledger.firstEventId !== eventId) throw new Error('NEW_EVENT_REQUIRED');
  if (product === 'dw_new_event' && !ledger.firstEventId) throw new Error('FIRST_EVENT_REQUIRED');
  if (product === 'dw_printables_topup' && !event.fullPlan) throw new Error('FULL_PLAN_REQUIRED');
  const extras = new Set(ledger.extras);
  if (product === 'dw_planner_printables' || product === 'dw_printables_topup') extras.add('printables');
  if (product === 'dw_planner_printables' || product === 'dw_day_of_kit') extras.add('day_of_kit');
  return { firstEventId: ledger.firstEventId ?? (unlock ? eventId : null), extras: [...extras], events: ledger.events.map(e => e.id === eventId && unlock ? { ...e, fullPlan: true } : e) };
}
/** Deleting visible plan data must never erase the purchase ledger or reuse its id. */
export function entitlementsFor(ledger: EventLedger, eventId: string): Entitlement[] {
  return [...ledger.extras, ...(ledger.events.some(e => e.id === eventId && e.fullPlan) ? ['full_plan' as const] : [])];
}

/** Ownership suppresses repeat sales even while Restore still owes a file. */
export function offerEntitlementsFor(ledger: EventLedger, eventId: string): Entitlement[] {
  return [...entitlementsFor(ledger, eventId), ...(ledger.purchasedExtras ?? [])];
}
