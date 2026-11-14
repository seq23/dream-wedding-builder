import { BUDGETS } from '@core/wedding-read-shared';
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

/** A budget she typed in her own words ("budget around 40000", "$40k", "40,000 budget"), as a
 * plain number string; '' when her words give none. */
export function typedBudget(words: string | undefined): string {
  const t = words ?? '';
  const m = t.match(/\$\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand)?\b/i)
    ?? t.match(/\bbudget\b[^\d$]{0,25}\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand)?\b/i)
    ?? t.match(/\b(\d[\d,]*(?:\.\d+)?)\s*(k|thousand)?\s*(?:dollars?\s+)?budget\b/i);
  if (!m) return '';
  const value = Number(m[1].replace(/,/g, '')) * (m[2] ? 1000 : 1);
  return Number.isFinite(value) && value >= 500 && value <= 10_000_000 ? String(Math.round(value)) : '';
}

/** What she already told the journey (guests, town, budget band) fills the Plan's details,
 * so she never types them twice. Anything she typed on the details screen wins. A budget
 * she typed in her own words wins over a band she tapped (first-time test, 14 Nov 2026:
 * "$25,000 to $50,000" plus "budget around 40000" must read $40,000, never $50,000). */
export function journeyDetails(details: Details, answers: { guests?: string; where?: string; budget?: string; wish?: string; path?: string }): Details {
  const next: Details = { ...details };
  if (!next.guestCount?.trim() && answers.guests?.trim()) next.guestCount = answers.guests.trim();
  if (!next.locations?.trim() && answers.where?.trim()) next.locations = answers.where.trim();
  const typed = answers.path === 'dk' ? '' : typedBudget(answers.wish);
  const current = next.budgetTarget?.trim() ?? '';
  if (typed && (!current || (BUDGETS as readonly string[]).includes(current))) next.budgetTarget = typed;
  else if (!current && answers.budget?.trim()) next.budgetTarget = answers.budget.trim();
  return next;
}
