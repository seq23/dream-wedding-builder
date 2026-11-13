import { parseDay } from '@core/dated-plan';
import type { Entitlement, ProductId } from './offers';
/** `grant` is the server's token for the one `dw_new_event` purchase that paid for this event. */
export interface PaidEvent { id: string; name: string; date: string; dateChanges: number; fullPlan: boolean; grant?: string }
/** `paidNewEvents` holds every new-event token the server door has confirmed to this phone. */
export interface EventLedger { firstEventId: string | null; events: PaidEvent[]; extras: Entitlement[]; purchasedExtras?: Entitlement[]; paidNewEvents?: string[] }
export const validGrant = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
/** Paid new events not started on this phone yet. One token starts one event, ever. */
export function unusedNewEvents(ledger: EventLedger): string[] {
  const used = new Set(ledger.events.map(e => e.grant));
  return [...new Set(ledger.paidNewEvents ?? [])].filter(token => !used.has(token));
}
/** Adds server-confirmed tokens to the phone's record. Tokens are never removed. */
export function withPaidNewEvents(ledger: EventLedger, tokens: readonly string[] = []): EventLedger {
  const all = [...new Set([...(ledger.paidNewEvents ?? []), ...tokens.filter(validGrant)])];
  return all.length ? { ...ledger, paidNewEvents: all } : ledger;
}
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
export function recordVerifiedPurchase(ledger: EventLedger, eventId: string, product: ProductId, grant?: string): EventLedger {
  const event = ledger.events.find(e => e.id === eventId);
  if (!event) throw new Error('EVENT_NOT_FOUND');
  const unlock = ['dw_full_plan', 'dw_planner_printables', 'dw_new_event'].includes(product);
  if (unlock && event.fullPlan) throw new Error('EVENT_ALREADY_PAID');
  if (unlock && product !== 'dw_new_event' && ledger.firstEventId && ledger.firstEventId !== eventId) throw new Error('NEW_EVENT_REQUIRED');
  if (product === 'dw_new_event' && !ledger.firstEventId) throw new Error('FIRST_EVENT_REQUIRED');
  // One confirmed store transaction pays for one event: a token already bound cannot pay again.
  if (product === 'dw_new_event' && !validGrant(grant)) throw new Error('NEW_EVENT_NOT_CONFIRMED');
  if (product === 'dw_new_event' && ledger.events.some(e => e.grant === grant)) throw new Error('NEW_EVENT_ALREADY_USED');
  if (product === 'dw_printables_topup' && !event.fullPlan) throw new Error('FULL_PLAN_REQUIRED');
  const extras = new Set(ledger.extras);
  if (product === 'dw_planner_printables' || product === 'dw_printables_topup') extras.add('printables');
  if (product === 'dw_planner_printables' || product === 'dw_day_of_kit') extras.add('day_of_kit');
  return { firstEventId: ledger.firstEventId ?? (unlock ? eventId : null), extras: [...extras], events: ledger.events.map(e => e.id === eventId && unlock ? { ...e, fullPlan: true, ...(product === 'dw_new_event' ? { grant } : {}) } : e),
    ...(product === 'dw_new_event' ? { paidNewEvents: [...new Set([...(ledger.paidNewEvents ?? []), grant as string])] } : ledger.paidNewEvents?.length ? { paidNewEvents: ledger.paidNewEvents } : {}) };
}
/** Deleting visible plan data must never erase the purchase ledger or reuse its id. */
export function entitlementsFor(ledger: EventLedger, eventId: string): Entitlement[] {
  return [...ledger.extras, ...(ledger.events.some(e => e.id === eventId && e.fullPlan) ? ['full_plan' as const] : [])];
}

/** Ownership suppresses repeat sales even while Restore still owes a file. */
export function offerEntitlementsFor(ledger: EventLedger, eventId: string): Entitlement[] {
  return [...entitlementsFor(ledger, eventId), ...(ledger.purchasedExtras ?? [])];
}
