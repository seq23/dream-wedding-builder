import { PLAN_WINDOWS, buildDatedPlan, type DatedPlan } from '@core/dated-plan';
import { addCustomTask, emptyProgress, parseProgress, taskKey, type PlanProgress } from '@core/plan-progress';

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
  const next = { done: { ...progress.done }, custom: progress.custom.map(t => t.id === id ? changed : t) };
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
