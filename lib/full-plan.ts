// The full plan a buyer of the Wedding Checklist PDF gets (owner, 10 Nov 2026): every
// task dated from HER wedding date, with wedding week and final payments, built for
// print. Until now the $9 file was an empty workbook she had to date herself.
//
// The task list is NOT in this repository. It is one JSON object in the private R2
// bucket (PRODUCT_RELEASES), read by the Worker for a buyer with an active entitlement.
// Only its counts are public, so every number on the site comes from the list's real
// length and is never typed. If the object is missing or unreadable the buyer still
// gets the zip she always got, and the Worker logs FULL_PLAN_LIST_MISSING.
import { addDays, buildDatedPlan, isoDay, monthsBefore, parseDay } from '@/lib/dated-plan';
import { taskKey, type PlanProgress } from '@/lib/plan-progress';

export const FULL_PLAN_KEY = 'plans/checklist-full-plan-v1.json';
/** Products whose buyers get the dated plan: the checklist, and the suite that contains it. */
export const FULL_PLAN_PRODUCT_IDS = ['checklist-pdf', 'operations-suite'];
export const FULL_PLAN_STOP = 'FULL_PLAN_LIST_MISSING';

export interface FullPlanTask { id: string; window: string; text: string; daysBefore: number; owner: string; kind: 'task' | 'payment' }
export interface FullPlanList { windows: { id: string; label: string }[]; tasks: FullPlanTask[] }
export interface DatedTask extends FullPlanTask { /** ISO yyyy-mm-dd. */ date: string; /** true when the date is already behind today. */ overdue: boolean }
export interface DatedSection { id: string; label: string; tasks: DatedTask[] }

/** Returns the list, or null when the object is not a usable list (never a half-read one). */
export function parseFullPlan(raw: unknown): FullPlanList | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as { windows?: unknown; tasks?: unknown };
  if (!Array.isArray(source.windows) || !Array.isArray(source.tasks)) return null;
  const windows = source.windows.filter((w): w is { id: string; label: string } => !!w && typeof w.id === 'string' && typeof w.label === 'string').map(w => ({ id: w.id, label: w.label }));
  const ids = new Set(windows.map(w => w.id));
  const tasks: FullPlanTask[] = [];
  for (const item of source.tasks as Record<string, unknown>[]) {
    if (!item || typeof item.id !== 'string' || typeof item.text !== 'string' || !item.text.trim() || typeof item.window !== 'string' || !ids.has(item.window) || typeof item.daysBefore !== 'number' || !Number.isFinite(item.daysBefore)) return null;
    tasks.push({ id: item.id, window: item.window, text: item.text, daysBefore: Math.round(item.daysBefore), owner: typeof item.owner === 'string' ? item.owner : '', kind: item.kind === 'payment' ? 'payment' : 'task' });
  }
  return tasks.length && windows.length ? { windows, tasks } : null;
}

/** Public counts only: how many tasks the full plan has, in total and per window. */
export function fullPlanCounts(list: FullPlanList) {
  const byWindow: Record<string, number> = {};
  for (const task of list.tasks) byWindow[task.window] = (byWindow[task.window] ?? 0) + 1;
  return { total: list.tasks.length, payments: list.tasks.filter(t => t.kind === 'payment').length, byWindow };
}

/** The ISO day a task falls on: her wedding date minus daysBefore (a negative number is after the wedding). */
export function taskDate(weddingDate: string, daysBefore: number): string | null {
  const wedding = parseDay(weddingDate);
  return wedding ? isoDay(addDays(wedding, -daysBefore)) : null;
}

/** Every task in the list, dated from her wedding date, in date order inside each window. Empty when the date is not a real day. */
export function datedFullPlan(list: FullPlanList, weddingDate: string, today: string): DatedSection[] {
  if (!parseDay(weddingDate)) return [];
  return list.windows.map(window => ({
    id: window.id,
    label: window.label,
    tasks: list.tasks.filter(task => task.window === window.id)
      .map(task => { const date = taskDate(weddingDate, task.daysBefore)!; return { ...task, date, overdue: date < today }; })
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  })).filter(section => section.tasks.length > 0);
}

/** The buyer's displayed and printed plan includes the tasks saved in the free planner. */
export function fullPlanView(list: FullPlanList, weddingDate: string, today: string, progress: PlanProgress) {
  const sections = datedFullPlan(list, weddingDate, today);
  // Use a reference day before every finite window so expired windows keep
  // their original end dates instead of disappearing from the display filter.
  const wedding = parseDay(weddingDate);
  const windows = wedding ? buildDatedPlan(weddingDate, isoDay(monthsBefore(wedding, 12))).windows : [];
  for (const custom of progress.custom) {
    const window = list.windows.find(w => w.id === custom.windowId);
    if (!window) continue;
    let section = sections.find(s => s.id === window.id);
    if (!section) {
      if (!parseDay(weddingDate)) continue;
      section = { ...window, tasks: [] };
      sections.push(section);
    }
    const date = windows.find(w => w.id === window.id)?.endsOn ?? weddingDate;
    section.tasks.push({ id: `custom:${custom.id}`, window: window.id, text: custom.text, daysBefore: 0, owner: '', kind: 'task', date, overdue: date < today });
  }
  sections.sort((a, b) => list.windows.findIndex(w => w.id === a.id) - list.windows.findIndex(w => w.id === b.id));
  const tasks = [...list.tasks, ...progress.custom.filter(c => list.windows.some(w => w.id === c.windowId)).map(c => ({ window: c.windowId, text: c.text }))];
  return { sections, total: tasks.length, done: tasks.filter(t => progress.done[taskKey(t.window, t.text)]).length };
}

type Bucket = { get(key: string): Promise<{ text(): Promise<string> } | null> };

/** Reads the list from the private bucket. null (and a named stop in the log) when it is missing or unreadable. */
export async function loadFullPlan(bucket: Bucket | undefined | null, where: string): Promise<FullPlanList | null> {
  const stop = (reason: string) => { console.error(JSON.stringify({ event: 'NAMED_STOP', stop: FULL_PLAN_STOP, where, reason, key: FULL_PLAN_KEY, fix: 'Upload the task list JSON to this key in the PRODUCT_RELEASES bucket. Buyers get the zip until then.' })); return null; };
  if (!bucket) return stop('PRODUCT_RELEASES binding is unavailable');
  try {
    const object = await bucket.get(FULL_PLAN_KEY);
    if (!object) return stop('object not found');
    return parseFullPlan(JSON.parse(await object.text())) ?? stop('object is not a valid task list');
  } catch (error) {
    return stop(error instanceof Error ? error.message : String(error));
  }
}
