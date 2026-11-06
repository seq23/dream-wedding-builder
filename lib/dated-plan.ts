// The dated plan: the site's promise is "the wedding checklist built around your
// actual date", and until 6 Nov 2026 the free Builder never asked for a date
// (hostile review: no date input anywhere on /free-wedding-planner, the packet
// printed "Season/date: Unknown"). This module turns one wedding date and today's
// date into planning windows with real calendar dates.
//
// All maths is on calendar days (year, month, day), never on Date timestamps, so a
// couple in Memphis at 11pm is not moved a day by UTC, and month steps clamp to the
// month's last day (29 Feb 2028 minus 12 months is 28 Feb 2027, not 1 Mar).

export interface CalendarDay { y: number; m: number; d: number }

export type DateState = 'none' | 'invalid' | 'past' | 'today' | 'future';

export interface PlanWindow {
  id: string;
  label: string;
  /** First day of the window (ISO yyyy-mm-dd). */
  startsOn: string;
  /** Last day of the window (ISO yyyy-mm-dd). */
  endsOn: string;
  /** done-late: the window ended before today, its tasks are folded into catch-up. */
  timing: 'passed' | 'now' | 'later';
  tasks: string[];
}

export interface DatedPlan {
  state: DateState;
  /** One plain line for the top of the plan. */
  headline: string;
  daysToGo: number | null;
  /** Tasks from windows that already closed, to do first. Empty unless the date is close. */
  catchUp: string[];
  windows: PlanWindow[];
  /** A gentle check when the date looks like a typo (more than 3 years out). */
  warning: string | null;
}

// Standard planning windows (months before the wedding). The tasks are general
// planning practice, not vendor quotes or legal advice; licence timing varies by
// county, so that task says to check it.
export const PLAN_WINDOWS: { id: string; label: string; fromMonths: number; toMonths: number; tasks: string[] }[] = [
  { id: '12-plus', label: '12+ months before', fromMonths: Infinity, toMonths: 9, tasks: [
    'Agree the total budget and who is contributing',
    'Draft the guest list and a headcount range',
    'Book the venue (it decides the date and the headcount)',
    'Book a planner or day-of coordinator if you want one'
  ] },
  { id: '9-months', label: '9 to 6 months before', fromMonths: 9, toMonths: 6, tasks: [
    'Book the photographer and the caterer',
    'Book the band or DJ',
    'Send save-the-dates (8 months or more ahead for travel weddings)',
    'Start looking for wedding attire'
  ] },
  { id: '6-months', label: '6 to 3 months before', fromMonths: 6, toMonths: 3, tasks: [
    'Book the florist, cake and rentals',
    'Reserve hotel room blocks for guests',
    'Set up the wedding website and registry',
    'Book hair and makeup, and meet the officiant'
  ] },
  { id: '3-months', label: '3 to 1 months before', fromMonths: 3, toMonths: 1, tasks: [
    'Order invitations and mail them 6 to 8 weeks before',
    'Book attire fittings and buy the rings',
    'Plan the rehearsal dinner and guest transport'
  ] },
  { id: '1-month', label: 'The last month', fromMonths: 1, toMonths: 0.25, tasks: [
    'Get the marriage licence (check your county’s waiting and validity period)',
    'Chase RSVPs and give the caterer the final headcount',
    'Make the seating chart and the day-of timeline',
    'Pay the balances that fall due'
  ] },
  { id: 'wedding-week', label: 'Wedding week', fromMonths: 0.25, toMonths: 0, tasks: [
    'Confirm every vendor’s arrival time and send them the timeline',
    'Put final payments and tips in labelled envelopes',
    'Pack for the night and the trip after',
    'Hand the day to your coordinator or a trusted friend, and rest'
  ] }
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function isLeapYear(y: number) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
export function daysInMonth(y: number, m: number) { return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; }

/** Strict yyyy-mm-dd reader: 2027-02-29 is not a date, so it is null rather than 1 March. */
export function parseDay(raw: unknown): CalendarDay | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(raw ?? '').trim());
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

export function isoDay({ y, m, d }: CalendarDay) { return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`; }

/** Today in the visitor's own clock (never toISOString, which is UTC). */
export function localToday(now = new Date()): string { return isoDay({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() }); }

function dayNumber({ y, m, d }: CalendarDay) { return Math.round(Date.UTC(y, m - 1, d) / 86_400_000); }
function fromDayNumber(n: number): CalendarDay { const dt = new Date(n * 86_400_000); return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() }; }

export function addDays(day: CalendarDay, days: number) { return fromDayNumber(dayNumber(day) + days); }
export function daysBetween(from: CalendarDay, to: CalendarDay) { return dayNumber(to) - dayNumber(from); }

/** Calendar months back, clamped to the target month's last day. */
export function monthsBefore(day: CalendarDay, months: number): CalendarDay {
  const index = day.y * 12 + (day.m - 1) - months;
  const y = Math.floor(index / 12);
  const m = index - y * 12 + 1;
  return { y, m, d: Math.min(day.d, daysInMonth(y, m)) };
}

/** A window edge given in months; 0.25 means one week. */
function edge(wedding: CalendarDay, months: number): CalendarDay {
  if (months === 0) return wedding;
  if (months === 0.25) return addDays(wedding, -7);
  return monthsBefore(wedding, months);
}

export function plainDate(iso: string): string {
  const day = parseDay(iso);
  if (!day) return iso;
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay()];
  return `${weekday} ${day.d} ${MONTHS[day.m - 1]} ${day.y}`;
}

function countdown(days: number): string {
  if (days === 1) return '1 day to go.';
  if (days < 14) return `${days} days to go.`;
  if (days < 63) return `${days} days to go (about ${Math.round(days / 7)} weeks).`;
  const months = Math.round(days / 30.44);
  if (months >= 18) return `${days} days to go (about ${Math.round(days / 365.25 * 2) / 2} years).`;
  return `${days} days to go (about ${months} months).`;
}

export function buildDatedPlan(weddingDate: unknown, today: string = localToday()): DatedPlan {
  const empty = { daysToGo: null, catchUp: [], windows: [], warning: null };
  const raw = String(weddingDate ?? '').trim();
  if (!raw) return { state: 'none', headline: 'Add your wedding date to see this plan with real dates.', ...empty };
  const wedding = parseDay(raw);
  if (!wedding) return { state: 'invalid', headline: 'That date does not exist. Check the day and the month.', ...empty };
  const now = parseDay(today);
  if (!now) throw new Error(`buildDatedPlan: today must be yyyy-mm-dd, got ${today}`);
  const days = daysBetween(now, wedding);
  if (days < 0) return { state: 'past', headline: `${plainDate(raw)} has already passed. Check the year, or enter your new date.`, ...empty };
  if (days === 0) return { state: 'today', headline: 'It is your wedding day. Nothing on a list matters more than enjoying it.', ...empty };

  const windows: PlanWindow[] = [];
  const catchUp: string[] = [];
  for (const w of PLAN_WINDOWS) {
    const end = addDays(edge(wedding, w.toMonths), w.toMonths === 0 ? 0 : -1);
    const start = w.fromMonths === Infinity ? null : edge(wedding, w.fromMonths);
    const endN = dayNumber(end);
    const todayN = dayNumber(now);
    if (endN < todayN) { catchUp.push(...w.tasks); continue; }
    const startDay = start && dayNumber(start) > todayN ? start : now;
    const timing: PlanWindow['timing'] = dayNumber(startDay) <= todayN ? 'now' : 'later';
    windows.push({ id: w.id, label: w.label, startsOn: isoDay(startDay), endsOn: isoDay(end), timing, tasks: w.tasks });
  }
  const warning = days > 3 * 366 ? `That is more than 3 years away (${plainDate(raw)}). If that is right, the first steps can wait; if not, check the year.` : null;
  const headline = countdown(days);
  return { state: 'future', headline, daysToGo: days, catchUp, windows, warning };
}
