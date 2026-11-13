import { parseDay } from '@core/dated-plan';
import { emptyLedger, moveEvent, type EventLedger, type PaidEvent } from './events';
import type { DateStorage } from '../weddingDate';
export const EVENT_LEDGER_KEY = 'dw.billing.events.v1';
export const ACTIVE_EVENT_KEY = 'dw.billing.active-event.v1';
/** Purchase history is retained on deletion. The active binding is plan content.
 * This ledger enforces edit policy; it never authorizes private downloads. */
export function parseLedger(raw: string | null): EventLedger {
  if (raw === null) return emptyLedger();
  try {
    const value = JSON.parse(raw) as EventLedger;
    if (!Array.isArray(value.events) || !Array.isArray(value.extras)) throw Error();
    const ids = new Set<string>();
    for (const event of value.events) {
      if (!event || typeof event.id !== 'string' || !event.id || ids.has(event.id)
        || typeof event.name !== 'string' || !event.name.trim() || event.name.length > 140
        || typeof event.date !== 'string' || !parseDay(event.date)
        || !Number.isInteger(event.dateChanges) || event.dateChanges < 0 || event.dateChanges > 3
        || typeof event.fullPlan !== 'boolean') throw Error();
      ids.add(event.id);
    }
    if (value.firstEventId !== null && !value.events.some(e => e.id === value.firstEventId && e.fullPlan)) throw Error();
    if (value.extras.some(e => e !== 'printables' && e !== 'day_of_kit') || new Set(value.extras).size !== value.extras.length) throw Error();
    if (value.purchasedExtras !== undefined && (!Array.isArray(value.purchasedExtras) || value.purchasedExtras.some(e => e !== 'printables' && e !== 'day_of_kit'))) throw Error();
    return { firstEventId: value.firstEventId, events: value.events, extras: value.extras, ...(value.purchasedExtras?.length ? { purchasedExtras: value.purchasedExtras } : {}) };
  } catch { throw Error('Your saved event history could not be read. Your plan has not been changed.'); }
}
export function eventStore(storage: DateStorage) {
  let queue: Promise<unknown> = Promise.resolve();
  const read = async () => parseLedger(await storage.getItem(EVENT_LEDGER_KEY));
  async function active(): Promise<PaidEvent | null> {
    const id = await storage.getItem(ACTIVE_EVENT_KEY);
    if (!id) return null;
    const event = (await read()).events.find(e => e.id === id);
    if (!event) throw Error('Your saved event could not be found. Your plan has not been changed.');
    return event;
  }
  return {
    read, active,
    /** A single-instance queue prevents rapid saves spending the same date allowance.
     * Store the event and date together in one blob: a failed write spends no move. */
    moveDate(date: string): Promise<boolean> {
      const job = queue.then(async () => {
        const event = await active();
        if (!event?.fullPlan) return false;
        const updated = moveEvent(event, date);
        if (updated !== event) {
          const ledger = await read();
          await storage.setItem(EVENT_LEDGER_KEY, JSON.stringify({ ...ledger, events: ledger.events.map(e => e.id === event.id ? updated : e) }));
        }
        return true;
      });
      queue = job.catch(() => {});
      return job;
    },
  };
}
