import { parseDay } from '@core/dated-plan';
/** The date the first screen opens with: the date she already saved when she came back to change
 * it, and nothing at all for someone new. A date she did not choose is never put in the field. */
export function startingDate(saved: string | null): string { return saved && parseDay(saved) ? saved : ''; }
/** Only a real date she picked can be saved from the main button. */
export function canSaveDate(date: string): boolean { return parseDay(date) !== null; }
