import { addEvent, recordVerifiedPurchase } from './events';
import { ACTIVE_EVENT_KEY, EVENT_LEDGER_KEY, eventStore } from './eventStore';
import type { PurchasesProvider } from './provider';
import { STORE_STOP } from './provider';
import type { downloadStore } from './downloadStore';
import type { DateStorage } from '../weddingDate';

/** Catalog availability affects buying only; Restore verifies independently. */
export async function checkoutCatalog(provider: PurchasesProvider, offering: string, ms = 10000) {
  try {
    const products = provider.available ? await checkoutRead(() => provider.products(offering), ms) : [];
    return { products, error: '' };
  } catch {
    return { products: [], error: 'Could not load store prices. You can still restore your purchase.' };
  }
}

/** Read-only native storage calls also need an end on a stalled device. */
export async function checkoutRead<T>(read: () => Promise<T>, ms = 10000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([read(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Error('Your event took too long to load. Close this screen and try again.')), ms);
    })]);
  } finally { clearTimeout(timer); }
}

/** First-event checkout only. SDK entitlement claims never authorize the event.
 * Store activation, extra products and consumable event bindings remain separate gates. */
export function checkout(storage: DateStorage, provider: PurchasesProvider,
  downloads: Pick<ReturnType<typeof downloadStore>, 'refresh'>, makeId: () => string, timeoutMs = 120000) {
  let busy = false;
  async function run(mode: 'purchase' | 'restore', name: string, date: string) {
    if (!provider.available) throw Error(STORE_STOP);
    if (busy) throw Error('A purchase check is already running.');
    busy = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let expired = false;
    const check = () => { if (expired) throw Error('Purchase check took too long. Restore your purchase and try again.'); };
    try {
      return await Promise.race([(async () => {
        const ledger = await eventStore(storage).read(); check();
        // Never sell the first non-consumable twice, or turn it into a new event.
        if (mode === 'purchase' && ledger.firstEventId) throw Error('Restore your existing event. A new event needs its own purchase.');
        const first = ledger.events.find(e => e.id === ledger.firstEventId);
        let next = ledger;
        let event = first;
        if (!event) {
          next = addEvent(ledger, makeId(), name, date);
          event = next.events[next.events.length - 1];
        }
        const snapshot = await (mode === 'purchase' ? provider.purchase('dw_full_plan') : provider.restore()); check();
        // refresh checks the server, downloads every full-plan asset, and commits
        // the cache only after all succeed. snapshot.active is deliberately ignored.
        await downloads.refresh(snapshot.userId); check();
        // A store sheet can remain open while the app changes elsewhere. Re-read
        // after verification so Restore cannot overwrite date moves or other events.
        const current = await eventStore(storage).read(); check();
        if (current.firstEventId && current.firstEventId !== event.id) throw Error('Your event changed during checkout. Restore and try again.');
        const latest = current.events.find(e => e.id === event.id);
        next = latest ? current : addEvent(current, event.id, event.name, event.date);
        if (!latest?.fullPlan) next = recordVerifiedPurchase(next, event.id, 'dw_full_plan');
        await storage.setItem(EVENT_LEDGER_KEY, JSON.stringify(next)); check();
        await storage.setItem(ACTIVE_EVENT_KEY, event.id);
        return event.id;
      })(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => { expired = true; reject(Error('Purchase check took too long. Restore your purchase and try again.')); }, timeoutMs);
      })]);
    } finally { clearTimeout(timer); busy = false; }
  }
  return { purchase: (name: string, date: string) => run('purchase', name, date), restore: (name: string, date: string) => run('restore', name, date) };
}
