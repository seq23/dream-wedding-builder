// "Add reminders to my calendar": the competitors send reminders only to signed-up
// accounts. This builds a standard .ics file in the browser (nothing is sent
// anywhere): one all-day reminder at the start of each planning window still
// ahead, listing what is not yet ticked, plus the wedding day itself.
import { addDays, parseDay, type DatedPlan } from '@/lib/dated-plan';

const compact = (iso: string) => iso.replace(/-/g, '');
const nextDay = (iso: string) => { const d = parseDay(iso)!; const n = addDays(d, 1); return `${n.y}${String(n.m).padStart(2, '0')}${String(n.d).padStart(2, '0')}`; };
/** RFC 5545 text escaping. */
export const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export function buildIcs(plan: DatedPlan, weddingDate: string, openTasks: (windowId: string, tasks: string[]) => string[], stamp: string): string | null {
  if (plan.state !== 'future') return null;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dream Wedding Builder//Dated plan//EN', 'CALSCALE:GREGORIAN'];
  const event = (uid: string, date: string, summary: string, description: string) => lines.push(
    'BEGIN:VEVENT', `UID:${uid}@weddingchecklistpdf.com`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${compact(date)}`, `DTEND;VALUE=DATE:${nextDay(date)}`,
    `SUMMARY:${icsText(summary)}`, `DESCRIPTION:${icsText(description)}`, 'END:VEVENT');
  for (const w of plan.windows) {
    const open = openTasks(w.id, w.tasks);
    if (!open.length) continue;
    event(`dwb-${weddingDate}-${w.id}`, w.startsOn, `Wedding plan: ${w.label}`, `${open.map(t => `- ${t}`).join('\n')}\n\nYour plan: https://weddingchecklistpdf.com/free-wedding-planner#your-date`);
  }
  event(`dwb-${weddingDate}-day`, weddingDate, 'Our wedding day', 'Enjoy it.');
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
