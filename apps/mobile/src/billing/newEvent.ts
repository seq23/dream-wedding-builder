import { buildDatedPlan, localToday } from '@core/dated-plan';

/** The date for a new event: the one she asked for when her current event ran out of
 * date changes, if it is a real date that has not passed; otherwise the current date. */
export function newEventDate(requested: string | string[] | undefined, current: string | null, today = localToday()): string | null {
  if (typeof requested === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(requested)) {
    const state = buildDatedPlan(requested, today).state;
    if (state !== 'invalid' && state !== 'past') return requested;
  }
  return current;
}
