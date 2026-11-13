import { buildDatedPlan, localToday, parseDay, PLAN_WINDOWS, monthsBefore, addDays, isoDay } from '@core/dated-plan';
import type { PlanProgress } from '@core/plan-progress';
import type { FullPlanList } from '@core/full-plan';
import { taskKey } from '@core/plan-progress';
import { taskRows } from './planTasks';

// Version B changes only this flag. Entitlements still belong to the paid event.
export const remindersNeedFullPlan = true;
export type ReminderChoice = 'unasked' | 'enabled' | 'off';
export interface Reminder { id: string; title: string; body: string; at: Date }
export function canRemind(fullPlan: boolean, needsFullPlan = remindersNeedFullPlan) { return fullPlan || !needsFullPlan; }
export function shouldOffer(choice: ReminderChoice, fullPlan: boolean, needsFullPlan = remindersNeedFullPlan) {
  return choice === 'unasked' && canRemind(fullPlan, needsFullPlan);
}
export function reminderSchedule(date: string, progress: PlanProgress, now: Date, fullPlan: boolean, needsFullPlan = remindersNeedFullPlan, list?: FullPlanList): Reminder[] {
  if (!canRemind(fullPlan, needsFullPlan)) return [];
  const plan = buildDatedPlan(date, localToday(now));
  // Once the wedding has passed only the list's after-the-wedding reminder can remain.
  if (plan.state !== 'future' && plan.state !== 'today' && !(plan.state === 'past' && list)) return [];
  const atNine = (iso: string) => { const d = parseDay(iso)!; return new Date(d.y, d.m - 1, d.d, 9); };
  const rows = list ? [...list.tasks.map(t => ({ windowId: t.window, text: t.text, doneAt: progress.done[taskKey(t.window, t.text)] })), ...taskRows(progress).filter(r => r.ownId)] : taskRows(progress);
  const wedding = parseDay(date)!;
  // Display windows clamp their start to today; reminders need the original edge.
  const reminders = PLAN_WINDOWS.filter(w => Number.isFinite(w.fromMonths)).flatMap(w => {
    const startsOn = isoDay(w.fromMonths === 0.25 ? addDays(wedding, -7) : monthsBefore(wedding, w.fromMonths));
    const open = rows.filter(r => r.windowId === w.id && !r.doneAt);
    return open.length ? [{ id: `dw-window-${w.id}`, title: w.label, body: open.map(r => r.text).join('\n'), at: atNine(startsOn) }] : [];
  });
  // The paid list also has windows the free plan lacks (after the wedding). Same rule:
  // one reminder when the window opens, naming its open tasks. A window whose tasks all
  // fall after the wedding opens the morning after it; any other opens on its first task's day.
  for (const w of list?.windows ?? []) {
    if (PLAN_WINDOWS.some(known => known.id === w.id)) continue;
    const offsets = list!.tasks.filter(t => t.window === w.id).map(t => t.daysBefore);
    const open = rows.filter(r => r.windowId === w.id && !r.doneAt);
    if (!offsets.length || !open.length) continue;
    const first = Math.max(...offsets);
    reminders.push({ id: `dw-window-${w.id}`, title: w.label, body: open.map(r => r.text).join('\n'), at: atNine(isoDay(addDays(wedding, first < 0 ? 1 : -first))) });
  }
  if (plan.state !== 'past') reminders.push({ id: 'dw-wedding-day', title: 'Your wedding day', body: 'Enjoy your day.', at: atNine(date) });
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
