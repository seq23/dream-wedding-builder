import { taskDate, type FullPlanList } from '@core/full-plan';
import { taskKey, type PlanProgress } from '@core/plan-progress';
import { type Payment } from './payments';
export interface Contact { id: string; name: string; phone: string; arrival: string; caller: string }
export interface WeekDetails { who: Record<string,string>; contacts: Contact[] }
export const weekKey = (preview: boolean) => preview ? 'dw.week.preview.v1' : 'dw.week.v1';
export function weekTasks(list: FullPlanList | null, date: string, progress: PlanProgress, unlocked: boolean) {
  if (!unlocked || !list) return [];
  return list.tasks.filter(t => t.daysBefore >= 0 && t.daysBefore <= 7).map(t => ({ ...t, date: taskDate(date,t.daysBefore), key: taskKey(t.window,t.text), doneAt: progress.done[taskKey(t.window,t.text)] })).filter(t => t.date).sort((a,b) => a.date!.localeCompare(b.date!));
}
export function weekEnvelopes(rows: Payment[], date: string, unlocked: boolean) {
  const start = taskDate(date,7);
  return unlocked && start ? rows.filter(r => r.date >= start && r.date <= date) : [];
}
export function weekStore(storage: { getItem(k:string): Promise<string|null>; setItem(k:string,v:string):Promise<void> }, preview: boolean) {
  return { async read(): Promise<WeekDetails> { const raw = await storage.getItem(weekKey(preview)); return raw ? JSON.parse(raw) : { who: {}, contacts: [] }; }, async save(value: WeekDetails) { await storage.setItem(weekKey(preview),JSON.stringify(value)); } };
}
