import type { DateStorage } from '../weddingDate';
import { SHARED_PAYMENTS_KEY, SHARED_WEEK_KEY } from './active';
/** Said wherever sharing is offered: amounts never travel, so nobody expects them to. */
export const SHARED_PAYMENTS_NOTE = 'Your partner sees who is paid and when, but not the amounts: amounts stay on the phone they were typed on.';
/** Each shared event has local amounts and contacts, separate from personal data.
 * Only the completion stamp travels. */
export function sharingDetails<T>(storage: DateStorage, key: typeof SHARED_PAYMENTS_KEY | typeof SHARED_WEEK_KEY, eventId: string, empty: () => T) {
  const readAll = async (): Promise<Record<string, T>> => JSON.parse(await storage.getItem(key) ?? '{}');
  return {
    async read(): Promise<T> { return (await readAll())[eventId] ?? empty(); },
    async save(value: T) { await storage.setItem(key, JSON.stringify({ ...await readAll(), [eventId]: value })); },
  };
}
