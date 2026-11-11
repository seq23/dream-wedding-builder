import { PLAN_WINDOWS, buildDatedPlan, type DatedPlan } from '@core/dated-plan';
import { addCustomTask, emptyProgress, parseProgress, removeCustomTask, taskKey, type PlanProgress } from '@core/plan-progress';

export function taskRows(progress: PlanProgress) {
  return PLAN_WINDOWS.flatMap(w => [
    ...w.tasks.map(text => ({ key: taskKey(w.id, text), windowId: w.id, text, ownId: undefined as string | undefined })),
    ...progress.custom.filter(t => t.windowId === w.id).map(t => ({ key: taskKey(t.windowId, t.text), windowId: t.windowId, text: t.text, ownId: t.id })),
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
  const stamp = next.done[taskKey(old.windowId, old.text)];
  delete next.done[taskKey(old.windowId, old.text)];
  if (stamp) next.done[taskKey(changed.windowId, changed.text)] = stamp;
  return next;
}
export function addOwnTask(progress: PlanProgress, windowId: string, text: string, id: string) {
  if (!PLAN_WINDOWS.some(w => w.id === windowId) || progress.custom.some(t => t.id === id)) return progress;
  return addCustomTask(progress, windowId, text, id);
}
export { removeCustomTask, buildDatedPlan };

export function progressStore(storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }) {
  const key = 'dw-plan-progress';
  let queue: Promise<unknown> = Promise.resolve();
  return {
    async read() { await queue; return parseProgress(await storage.getItem(key)); },
    update(change: (p: PlanProgress) => PlanProgress): Promise<PlanProgress> {
      const operation = queue.then(async () => {
        const next = change(parseProgress(await storage.getItem(key)));
        await storage.setItem(key, JSON.stringify(next));
        return next;
      });
      queue = operation.catch(() => {});
      return operation;
    },
  };
}
