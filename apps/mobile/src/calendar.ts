import { buildDatedPlan } from '@core/dated-plan';
import { buildIcs } from '@core/plan-ics';
import type { PlanProgress } from '@core/plan-progress';
import { taskRows } from './planTasks';

export function calendarFile(date: string | null, progress: PlanProgress, now = new Date()): string {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const rows = taskRows(progress);
  const result = buildIcs(buildDatedPlan(date ?? '', today), date ?? '',
    id => rows.filter(row => row.windowId === id && !row.doneAt).map(row => row.text),
    now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'));
  if (!result) throw new Error('Set a future wedding date to save your calendar file.');
  return result;
}
