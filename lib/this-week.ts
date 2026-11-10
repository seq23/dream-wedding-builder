// "This week": what she sees first every time she comes back (value review, 10 Nov
// 2026: nothing on the plan said what to do next, so there was no reason to return).
// It is the next few tasks she has not ticked, in plan order, each with the date its
// planning window closes, and the day the next window opens. Pure arithmetic on her
// plan and her ticks; nothing is sent anywhere and nothing reminds her by itself.
import type { DatedPlan } from '@/lib/dated-plan';

export interface NextTask { windowId: string; text: string; /** ISO day the task's window closes; '' for catch-up tasks, which are already due. */ by: string }
export interface ThisWeek { tasks: NextTask[]; /** Undone tasks left in the plan, including the ones shown. */ left: number; nextWindow: { label: string; opensOn: string } | null }

export function thisWeek(plan: DatedPlan, tasksFor: (windowId: string, base: string[]) => string[], isDone: (windowId: string, text: string) => boolean, limit = 3): ThisWeek {
  const undone: NextTask[] = [];
  for (const text of plan.catchUp) if (!isDone('catch-up', text)) undone.push({ windowId: 'catch-up', text, by: '' });
  for (const window of plan.windows) {
    if (window.timing === 'passed') continue;
    for (const text of tasksFor(window.id, window.tasks)) if (!isDone(window.id, text)) undone.push({ windowId: window.id, text, by: window.endsOn });
  }
  const later = plan.windows.find(window => window.timing === 'later');
  return { tasks: undone.slice(0, limit), left: undone.length, nextWindow: later ? { label: later.label, opensOn: later.startsOn } : null };
}
