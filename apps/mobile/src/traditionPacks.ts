import { PLAN_WINDOWS } from '@core/dated-plan';
import { type CustomTask, type PlanProgress } from '@core/plan-progress';
import { addOwnTask, ownTaskKey, removeCustomTask } from './planTasks';

// Only names and one free example per pack belong in the bundle. Full packs arrive
// through the verified purchase door (task 8); this module performs no downloads.
export const TRADITION_PREVIEWS = [
  { id: 'catholic', name: 'Catholic', example: { id: 'parish', windowId: '9-months', text: 'Contact your parish about marriage preparation.', source: 'https://www.usccb.org/topics/marriage-and-family-life-ministries/marriage-preparation' } },
  { id: 'jewish', name: 'Jewish', example: { id: 'officiant', windowId: '9-months', text: 'Discuss the ceremony you want with your rabbi or cantor.', source: 'https://www.myjewishlearning.com/article/planning-your-jewish-wedding/' } },
  { id: 'hindu', name: 'Hindu', example: { id: 'priest', windowId: '9-months', text: 'Discuss your ceremony and its items with your chosen priest.', source: 'https://www.dfwhindutemple.org/services/priest-services/' } },
  { id: 'muslim-nikah', name: 'Muslim nikah', example: { id: 'imam', windowId: '9-months', text: 'Ask your imam about arranging your nikah.', source: 'https://icorlando.org/service/marriage-nikah/' } },
  { id: 'nigerian', name: 'Nigerian traditional', example: { id: 'family', windowId: '9-months', text: 'Talk with both families about the traditions you want to include.', source: 'https://www.laits.utexas.edu/africa/2004/database/adejola.html' } },
  { id: 'mexican', name: 'Mexican', example: { id: 'rituals', windowId: '9-months', text: 'Decide together whether to include the lazo or arras.', source: 'https://folklore.usc.edu/the-lazo-and-arras-in-mexican-wedding-tradition/' } },
  { id: 'chinese-tea', name: 'Chinese tea ceremony', example: { id: 'elders', windowId: '9-months', text: 'Agree with your families which elders you will serve tea to.', source: 'https://archive.chcp.org/virtual-museum-library/qa-chinese-wedding-tea-ceremony/' } },
] as const;
export interface TraditionTask { id: string; windowId: string; text: string; source: string }
export interface TraditionPack { id: string; tasks: TraditionTask[] }
export interface PackOrigin { packId: string; taskId: string; text: string; windowId: string; source: string }
export type TraditionCustomTask = CustomTask & { tradition?: PackOrigin };
const windowIds = new Set(PLAN_WINDOWS.map(w => w.id));
function secureLink(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try { const url = new URL(value); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password; } catch { return false; }
}
/** Reject the entire delivered file if any task is unusable. No partial packs. */
export function parseTraditionPack(raw: unknown): TraditionPack | null {
  if (!raw || typeof raw !== 'object') return null;
  const pack = raw as Record<string, unknown>;
  if (!TRADITION_PREVIEWS.some(p => p.id === pack.id) || !Array.isArray(pack.tasks) || !pack.tasks.length) return null;
  const tasks: TraditionTask[] = [];
  const ids = new Set<string>();
  for (const value of pack.tasks) {
    if (!value || typeof value !== 'object') return null;
    const t = value as Record<string, unknown>;
    if (typeof t.id !== 'string' || !/^[a-z0-9-]+$/.test(t.id) || ids.has(t.id) || typeof t.windowId !== 'string' || !windowIds.has(t.windowId) || typeof t.text !== 'string' || !t.text.trim() || t.text.length > 140 || !secureLink(t.source)) return null;
    ids.add(t.id);
    tasks.push({ id: t.id, windowId: t.windowId, text: t.text.replace(/\s+/g, ' ').trim(), source: t.source });
  }
  return { id: pack.id as string, tasks };
}
/** Entitlement is supplied by the purchase layer, never inferred from bundled data. */
export function addTraditionPack(progress: PlanProgress, raw: unknown, fullPlan: boolean): PlanProgress {
  const pack = fullPlan ? parseTraditionPack(raw) : null;
  if (!pack) return progress;
  let next = progress;
  for (const task of pack.tasks) {
    const id = `tradition:${pack.id}:${task.id}`;
    if (next.custom.some(t => t.id === id)) continue;
    next = addOwnTask(next, task.windowId, task.text, id);
    next = { ...next, custom: next.custom.map(t => t.id === id ? { ...t, tradition: { packId: pack.id, taskId: task.id, text: t.text, windowId: t.windowId, source: task.source } } : t) };
  }
  return next;
}
/** Retained rows keep their identity, provenance and completion on re-add. */
export function removeTraditionPack(progress: PlanProgress, packId: string): PlanProgress {
  return progress.custom.reduce((next, custom: TraditionCustomTask) => {
    const origin = custom.tradition;
    if (origin?.packId !== packId || progress.done[ownTaskKey(custom.id)] || custom.text !== origin.text || custom.windowId !== origin.windowId) return next;
    return removeCustomTask(next, custom.id);
  }, progress);
}
