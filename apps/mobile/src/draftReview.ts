import type { DateStorage } from './weddingDate';
// Only details the plan uses (src/planDetails.ts): a detail that changes nothing is not asked for or kept.
export const detailLabels = { weddingDate: 'Wedding date', guestCount: 'Guests', locations: 'Place', budgetTarget: 'Budget', budgetMode: 'Budget approach', priorities: 'What matters most' };
export type Details = Partial<Record<keyof typeof detailLabels, string>>;
export function reviewFields(draft: Record<string, unknown>): Details {
  const result: Details = {};
  for (const key of Object.keys(detailLabels) as (keyof Details)[]) {
    const value = draft[key];
    const text = Array.isArray(value) ? value.filter(v => typeof v === 'string').join(', ') : typeof value === 'string' ? value : '';
    if (text.trim()) result[key] = text.trim();
  }
  return result;
}
const KEY = 'dw.planning-details.v1';
export function detailStore(storage: DateStorage) {
  return {
    async read(): Promise<Details> { return reviewFields(JSON.parse(await storage.getItem(KEY) ?? '{}')); },
    async save(details: Details) { await storage.setItem(KEY, JSON.stringify(details)); },
  };
}

/** The saved plan date is authoritative, including an explicitly unset date. */
export async function initialDetails(store: ReturnType<typeof detailStore>, date: { read(): Promise<string | null> }): Promise<Details> {
  const [details, weddingDate] = await Promise.all([store.read(), date.read()]);
  return weddingDate === null ? details : { ...details, weddingDate };
}
