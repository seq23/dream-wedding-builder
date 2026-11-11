import { buildDatedPlan, localToday, parseDay } from '@core/dated-plan';
import type { PlanProgress } from '@core/plan-progress';
import { taskRows } from './planTasks';

// Version B changes only this flag. Entitlements still belong to the paid event.
export const remindersNeedFullPlan = true;
export type ReminderChoice = 'unasked' | 'enabled' | 'off';
export interface Reminder { id: string; title: string; body: string; at: Date }
export function canRemind(fullPlan: boolean, needsFullPlan = remindersNeedFullPlan) { return fullPlan || !needsFullPlan; }
export function shouldOffer(choice: ReminderChoice, fullPlan: boolean, needsFullPlan = remindersNeedFullPlan) {
  return choice === 'unasked' && canRemind(fullPlan, needsFullPlan);
}
export function reminderSchedule(date: string, progress: PlanProgress, now: Date, fullPlan: boolean, needsFullPlan = remindersNeedFullPlan): Reminder[] {
  if (!canRemind(fullPlan, needsFullPlan)) return [];
  const plan = buildDatedPlan(date, localToday(now));
  if (plan.state !== 'future' && plan.state !== 'today') return [];
  const atNine = (iso: string) => { const d = parseDay(iso)!; return new Date(d.y, d.m - 1, d.d, 9); };
  const rows = taskRows(progress);
  const reminders = plan.windows.filter(w => w.timing === 'later').flatMap(w => {
    const open = rows.filter(r => r.windowId === w.id && !r.doneAt);
    return open.length ? [{ id: `dw-window-${w.id}`, title: w.label, body: open.map(r => r.text).join('\n'), at: atNine(w.startsOn) }] : [];
  });
  reminders.push({ id: 'dw-wedding-day', title: 'Your wedding day', body: 'Enjoy your day.', at: atNine(date) });
  return reminders.filter(r => r.at.getTime() > now.getTime());
}
export interface ReminderDriver {
  cancel(): Promise<void>;
  allowed(): Promise<boolean>;
  schedule(reminder: Reminder): Promise<void>;
}
export async function replaceReminders(driver: ReminderDriver, reminders: Reminder[], enabled: boolean) {
  await driver.cancel();
  if (!enabled || !reminders.length || !await driver.allowed()) return;
  try { for (const reminder of reminders) await driver.schedule(reminder); }
  catch (error) { await driver.cancel(); throw error; }
}
