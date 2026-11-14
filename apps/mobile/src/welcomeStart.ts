import { buildDatedPlan, localToday, parseDay } from '@core/dated-plan';
/** The date the first screen opens with: the date she already saved when she came back to change
 * it, and nothing at all for someone new. A date she did not choose is never put in the field. */
export function startingDate(saved: string | null): string { return saved && parseDay(saved) ? saved : ''; }
/** Only a real date she picked can be saved from the main button. */
export function canSaveDate(date: string): boolean { return parseDay(date) !== null; }
/** 'past' asks "Is that right?" before saving; a wedding that already happened is allowed. */
export function dateCheck(date: string, today: string = localToday()): 'none' | 'invalid' | 'past' | 'ok' {
  if (!date.trim()) return 'none';
  const state = buildDatedPlan(date, today).state;
  return state === 'invalid' ? 'invalid' : state === 'past' ? 'past' : 'ok';
}
/** Clearing a date she saved earlier asks first; with nothing saved there is nothing to lose. */
export function clearNeedsConfirm(saved: string | null): boolean { return !!saved && parseDay(saved) !== null; }
