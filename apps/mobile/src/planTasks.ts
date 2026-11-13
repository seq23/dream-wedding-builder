import { FULL_PLAN_TEASER } from '@core/full-plan-teaser';
import { addDays, isoDay, parseDay, PLAN_WINDOWS, buildDatedPlan, type DatedPlan } from '@core/dated-plan';
import { addCustomTask, emptyProgress, parseProgress, taskKey, type PlanProgress } from '@core/plan-progress';
import { taskDate, type FullPlanList } from '@core/full-plan';

export function taskRows(progress: PlanProgress) {
  return PLAN_WINDOWS.flatMap(w => [
    ...w.tasks.map(text => ({ key: taskKey(w.id, text), windowId: w.id, text, ownId: undefined as string | undefined })),
    ...progress.custom.filter(t => t.windowId === w.id).map(t => ({ key: ownTaskKey(t.id), windowId: t.windowId, text: t.text, ownId: t.id })),
  ]).map(row => ({ ...row, doneAt: progress.done[row.key] }));
}
export function taskCount(progress: PlanProgress) {
  const rows = taskRows(progress);
  return { done: rows.filter(r => r.doneAt).length, total: rows.length };
}
export function catchUpRows(progress: PlanProgress, plan: DatedPlan) {
  if (plan.state !== 'future') return [];
  const remaining = new Set(plan.windows.map(w => w.id));
  return taskRows(progress).filter(r => !remaining.has(r.windowId) && !r.doneAt);
}
export function editOwnTask(progress: PlanProgress, id: string, windowId: string, text: string) {
  const old = progress.custom.find(t => t.id === id);
  if (!old || !PLAN_WINDOWS.some(w => w.id === windowId) || !text.trim()) return progress;
  const changed = addCustomTask(emptyProgress(), windowId, text, id).custom[0];
  const next = { done: { ...progress.done }, custom: progress.custom.map(t => t.id === id ? { ...t, ...changed } : t) };
  return next;
}
export function addOwnTask(progress: PlanProgress, windowId: string, text: string, id: string) {
  if (!PLAN_WINDOWS.some(w => w.id === windowId) || progress.custom.some(t => t.id === id)) return progress;
  return addCustomTask(progress, windowId, text, id);
}
export const ownTaskKey = (id: string) => `own::${id}`;
export function removeCustomTask(progress: PlanProgress, id: string): PlanProgress {
  const done = { ...progress.done };
  delete done[ownTaskKey(id)];
  return { done, custom: progress.custom.filter(task => task.id !== id) };
}
export { buildDatedPlan };
function readProgress(raw: string | null): PlanProgress {
  const progress = parseProgress(raw);
  try { if (raw && JSON.parse(raw).identityVersion === 1) return progress; } catch { /* parseProgress resets invalid data */ }
  const builtInKeys = new Set(PLAN_WINDOWS.flatMap(w => w.tasks.map(text => taskKey(w.id, text))));
  // Preserve ticks from the earlier text-keyed preview without stealing a built-in tick.
  for (const task of progress.custom) {
    const legacy = taskKey(task.windowId, task.text);
    if (progress.done[legacy] && !progress.done[ownTaskKey(task.id)]) progress.done[ownTaskKey(task.id)] = progress.done[legacy];
  }
  for (const task of progress.custom) {
    const legacy = taskKey(task.windowId, task.text);
    if (!builtInKeys.has(legacy)) delete progress.done[legacy];
  }
  return progress;
}

export function progressStore(storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }) {
  const key = 'dw-plan-progress';
  let queue: Promise<unknown> = Promise.resolve();
  return {
    async read() { await queue; return readProgress(await storage.getItem(key)); },
    update(change: (p: PlanProgress) => PlanProgress): Promise<PlanProgress> {
      const operation = queue.then(async () => {
        const next = change(readProgress(await storage.getItem(key)));
        await storage.setItem(key, JSON.stringify({ ...next, identityVersion: 1 }));
        return next;
      });
      queue = operation.catch(() => {});
      return operation;
    },
  };
}

export function nextTaskRows(progress: PlanProgress) {
  return taskRows(progress).filter(row => !row.doneAt).slice(0, 3);
}
export function completionDay(stamp: string) {
  return new Date(stamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function initialTaskWindow(requested?: string) {
  return PLAN_WINDOWS.find(w => w.id === requested)?.id ?? PLAN_WINDOWS[0].id;
}

// Public sample names only; these rows never enter progress or completion totals.
/** `startedOn` is the day she began (src/planStart.ts). A task whose date fell before that day
 * carries no date: it is "Start here", so a brand-new plan never shows a locked task dated in the past. */
export function lockedPlanRows(date: string, windowId: string, startedOn: string) {
  const wedding = parseDay(date);
  if (!wedding) return [];
  return (FULL_PLAN_TEASER[windowId] ?? []).map(task => {
    const due = isoDay(addDays(wedding, -task.daysBefore));
    return { text: task.text, dueOn: due < startedOn ? null : due, startHere: due < startedOn, href: '/more/full-plan' as const };
  });
}
export function planOverview(progress: PlanProgress, plan: DatedPlan) {
  return {
    next: nextTaskRows(progress),
    overdue: catchUpRows(progress, plan),
    nextStartsOn: plan.windows.find(w => w.timing === 'later')?.startsOn ?? null,
  };
}

/** Rows of the delivered full list. A task is late when its own date has passed and it is
 * not ticked. Never by window: the list has an after-the-wedding window the free plan does
 * not, and those tasks are not "catch up" before the wedding. */
export function fullPlanRows(list: FullPlanList, progress: PlanProgress, date: string, today: string) {
  return list.tasks.map(t => {
    const key = taskKey(t.window, t.text), dueOn = taskDate(date, t.daysBefore), doneAt = progress.done[key];
    return { key, windowId: t.window, text: t.text, ownId: undefined as string | undefined, doneAt, dueOn, late: !doneAt && !!dueOn && dueOn < today };
  });
}

/** The blocks above the list. A task appears once. Late tasks that were already due on the day
 * she began (`beforeStart`) go under "Start here"; tasks that fell due since go under "Catch up";
 * "Do these next" is the next three open tasks that are not late (docs/APP_PLAN.md, pattern (b)). */
export function planBlocks<T extends { key: string; doneAt?: string }>(rows: T[], late: T[], beforeStart: Set<string> = new Set()) {
  const lateKeys = new Set(late.map(r => r.key));
  return {
    startHere: late.filter(r => beforeStart.has(r.key)),
    catchUp: late.filter(r => !beforeStart.has(r.key)),
    next: rows.filter(r => !r.doneAt && !lateKeys.has(r.key)).slice(0, 3),
  };
}

/** Keys of the tasks that were already due on the day she began: by the task's own date where it
 * has one, otherwise by its window having closed before that day. */
export function dueBeforeStart<T extends { key: string; windowId: string; dueOn?: string | null }>(rows: T[], weddingDate: string, startedOn: string) {
  const atStart = buildDatedPlan(weddingDate, startedOn);
  if (atStart.state !== 'future') return new Set<string>();
  const open = new Set(atStart.windows.map(w => w.id));
  return new Set(rows.filter(r => r.dueOn ? r.dueOn < startedOn : !open.has(r.windowId)).map(r => r.key));
}
