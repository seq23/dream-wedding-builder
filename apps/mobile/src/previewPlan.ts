import { PLAN_WINDOWS } from '@core/dated-plan';
import { addCustomTask, emptyProgress, taskKey, toggleDone, type PlanProgress } from '@core/plan-progress';

export function samplePlan() {
  let progress = addCustomTask(emptyProgress(), '9-months', 'Ask a friend to bring the guest book', 'preview-own-task');
  const first = PLAN_WINDOWS[0];
  for (const text of first.tasks.slice(0, 2)) progress = toggleDone(progress, taskKey(first.id, text), '2026-11-06T09:00:00.000Z');
  return { date: '2027-06-12', progress };
}

export async function loadSamplePlan(enabled: boolean, dates: { save(value: string, today: string): Promise<void> }, progress: { update(change: (old: PlanProgress) => PlanProgress): Promise<PlanProgress> }) {
  if (!enabled) throw new Error('PREVIEW_DISABLED');
  const sample = samplePlan();
  await dates.save(sample.date, '2026-11-06');
  await progress.update(() => sample.progress);
}
