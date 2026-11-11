import { buildDatedPlan, localToday } from '@core/dated-plan';
export interface DateStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
const KEY = 'dw.wedding-date.v1';
export function dateStore(storage: DateStorage) {
  return {
    async read(): Promise<string | null> { return storage.getItem(KEY); },
    async save(date: string, today = localToday()) {
      const plan = buildDatedPlan(date, today);
      if (plan.state === 'invalid' || plan.state === 'past') throw new Error(plan.headline);
      await storage.setItem(KEY, date);
    },
  };
}
