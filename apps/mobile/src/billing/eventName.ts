import type { DateStorage } from '../weddingDate';
import { eventStore } from './eventStore';

export const EVENT_NAME_KEY = 'dw.event-name.v1';
export const NEW_EVENT_NAME_KEY = 'dw.new-event-name.v1';
/** A name is preparation for checkout, never purchase evidence or an active-event switch. */
export function eventNameStore(storage: DateStorage, newEvent = false) {
  const key = newEvent ? NEW_EVENT_NAME_KEY : EVENT_NAME_KEY;
  return {
    async read() {
      const event = await eventStore(storage).active();
      if (!newEvent && event?.fullPlan) return { name: event.name, locked: true };
      return { name: await storage.getItem(key) ?? '', locked: false };
    },
    async save(value: string) {
      const current = await this.read();
      if (current.locked) throw Error('EVENT_NAME_LOCKED');
      const name = value.trim();
      if (!name || name.length > 140) throw Error('Enter an event name of 1 to 140 characters.');
      await storage.setItem(key, name);
      return name;
    },
  };
}
