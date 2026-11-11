import { eventStore } from './billing/eventStore';
import { buildDatedPlan, localToday } from '@core/dated-plan';
export interface DateStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
const KEY = 'dw.wedding-date.v1';
export function dateStore(storage: DateStorage) {
  const events = eventStore(storage);
  return {
    async read(): Promise<string | null> { const event = await events.active(); return event?.fullPlan ? event.date : storage.getItem(KEY); },
    async save(date: string, today = localToday()) {
      const plan = buildDatedPlan(date, today);
      if (plan.state === 'invalid' || plan.state === 'past') throw new Error(plan.headline);
      if (await events.moveDate(date)) return;
      await storage.setItem(KEY, date);
    },
  };
}
