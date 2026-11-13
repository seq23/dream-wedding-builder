import type { DateStorage } from './weddingDate';
export const PLAN_START_KEY = 'dw.plan-started.v1';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** The day she began planning toward this wedding date, remembered on the phone. Tasks that were
 * already due on that day are "Start here", not "Catch up": she is not behind on a list she did
 * not have. A new or moved wedding date begins again from today. No date: nothing is stored. */
export function planStartStore(storage: DateStorage) {
  return {
    async read(weddingDate: string, today: string): Promise<string> {
      if (!weddingDate) return today;
      try {
        const saved = JSON.parse((await storage.getItem(PLAN_START_KEY)) ?? 'null');
        if (saved?.date === weddingDate && DAY.test(saved.startedOn) && saved.startedOn <= today) return saved.startedOn;
      } catch { /* unreadable: begin again from today */ }
      await storage.setItem(PLAN_START_KEY, JSON.stringify({ date: weddingDate, startedOn: today }));
      return today;
    },
  };
}
