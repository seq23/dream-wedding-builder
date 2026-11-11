import { addEvent, entitlementsFor, recordVerifiedPurchase } from './events';
import { offersFor, type ProductId } from './offers';
import { ACTIVE_EVENT_KEY, EVENT_LEDGER_KEY, eventStore } from './eventStore';
import type { PurchasesProvider } from './provider';
import { STORE_STOP } from './provider';
import type { DownloadedPlan } from './downloadStore';
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

type CheckoutContent = DownloadedPlan;
/** SDK claims never authorize an event or an extra: only delivered server assets
 * do. Consumable event bindings remain a separate gate. */
export function checkout(storage: DateStorage, provider: PurchasesProvider,
  downloads: { refresh(userId: string): Promise<CheckoutContent> }, makeId: () => string, timeoutMs = 120000) {
  let busy = false;
  async function run(mode: 'purchase' | 'restore', name: string, date: string, product: ProductId = 'dw_full_plan') {
    if (!provider.available) throw Error(STORE_STOP);
    if (busy) throw Error('A purchase check is already running.');
    busy = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let expired = false;
    const check = () => { if (expired) throw Error('Purchase check took too long. Restore your purchase and try again.'); };
    try {
      return await Promise.race([(async () => {
        const ledger = await eventStore(storage).read(); check();
        const extra = product === 'dw_printables_topup' || product === 'dw_day_of_kit';
        const active = extra && mode === 'purchase' ? await eventStore(storage).active() : null; check();
        // Never sell the first non-consumable twice, or turn it into a new event.
        if (mode === 'purchase') {
          if (product === 'dw_new_event') throw Error('New-event purchases are not available yet. Your current event has not changed.');
          if (!extra && ledger.firstEventId) throw Error('Restore your existing event. A new event needs its own purchase.');
          if (extra && !active?.fullPlan) throw Error('Restore your full plan before adding extras.');
          if (!offersFor(entitlementsFor(ledger, active?.id ?? '')).includes(product)) throw Error('This product is already included in your plan.');
        }
        const first = ledger.events.find(e => e.id === ledger.firstEventId);
        let next = ledger;
        let event = active ?? first;
        if (!event) {
          next = addEvent(ledger, makeId(), name, date);
          event = next.events[next.events.length - 1];
        }
        const snapshot = await (mode === 'purchase' ? provider.purchase(product) : provider.restore()); check();
        // refresh verifies the full plan and keeps it if an optional archive fails.
        // Only successfully saved files grant extras; snapshot.active is ignored.
        const content = await downloads.refresh(snapshot.userId); check();
        const printables = !!content.archives?.printables;
        const kit = !!content.archives?.['day-of-kit'];
        // A store sheet can remain open while the app changes elsewhere. Re-read
        // after verification so Restore cannot overwrite date moves or other events.
        const current = await eventStore(storage).read(); check();
        if ((!extra || mode === 'restore') && current.firstEventId && current.firstEventId !== event.id) throw Error('Your event changed during checkout. Restore and try again.');
        if (extra && mode === 'purchase' && await storage.getItem(ACTIVE_EVENT_KEY) !== event.id) throw Error('Your event changed during checkout. Restore and try again.');
        check();
        const latest = current.events.find(e => e.id === event.id);
        next = latest ? current : addEvent(current, event.id, event.name, event.date);
        if (!latest?.fullPlan) next = recordVerifiedPurchase(next, event.id, mode === 'purchase' ? product : 'dw_full_plan');
        // These per-person grants come from the verified cache, never snapshot.active.
        next = { ...next, extras: [...(printables ? ['printables' as const] : []), ...(kit ? ['day_of_kit' as const] : [])] };
        await storage.setItem(EVENT_LEDGER_KEY, JSON.stringify(next)); check();
        await storage.setItem(ACTIVE_EVENT_KEY, event.id);
        return event.id;
      })(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => { expired = true; reject(Error('Purchase check took too long. Restore your purchase and try again.')); }, timeoutMs);
      })]);
    } finally { clearTimeout(timer); busy = false; }
  }
  return { purchase: (name: string, date: string, product?: ProductId) => run('purchase', name, date, product), restore: (name: string, date: string) => run('restore', name, date) };
}
