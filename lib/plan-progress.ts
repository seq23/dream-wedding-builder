// What the couple has ticked off in their dated plan, and the tasks they added
// themselves. Zola, The Knot and WeddingWire all let a couple tick tasks and add
// their own - but only after an account (journey review, 6 Nov 2026). Here it is
// kept in the couple's own browser, like the rest of the plan, with no account.
export const PROGRESS_KEY = 'dwb-plan-progress';

export interface CustomTask { id: string; windowId: string; text: string }
export interface PlanProgress { done: Record<string, string>; custom: CustomTask[] }

export const emptyProgress = (): PlanProgress => ({ done: {}, custom: [] });

export const taskKey = (windowId: string, text: string) => `${windowId}::${text}`;

export function parseProgress(text: string | null): PlanProgress {
  if (!text) return emptyProgress();
  try {
    const raw = JSON.parse(text) as Record<string, unknown>;
    const done: Record<string, string> = {};
    if (raw && typeof raw.done === 'object' && raw.done && !Array.isArray(raw.done)) {
      for (const [k, v] of Object.entries(raw.done as Record<string, unknown>)) if (typeof v === 'string') done[k] = v;
    }
    const custom = Array.isArray(raw?.custom) ? (raw.custom as unknown[]).filter((c): c is CustomTask => !!c && typeof c === 'object' && typeof (c as CustomTask).id === 'string' && typeof (c as CustomTask).windowId === 'string' && typeof (c as CustomTask).text === 'string').map(c => ({ ...c, text: c.text.slice(0, 140) })) : [];
    return { done, custom };
  } catch { return emptyProgress(); }
}

export function loadProgress(storage: Pick<Storage, 'getItem'>): PlanProgress {
  try { return parseProgress(storage.getItem(PROGRESS_KEY)); } catch { return emptyProgress(); }
}

export function saveProgress(storage: Pick<Storage, 'setItem'>, progress: PlanProgress) {
  try { storage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch { /* storage blocked: ticks last this visit */ }
}

export function toggleDone(progress: PlanProgress, key: string, now: string): PlanProgress {
  const done = { ...progress.done };
  if (done[key]) delete done[key]; else done[key] = now;
  return { ...progress, done };
}

export function addCustomTask(progress: PlanProgress, windowId: string, text: string, id: string): PlanProgress {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, 140);
  if (!clean) return progress;
  return { ...progress, custom: [...progress.custom, { id, windowId, text: clean }] };
}

export function removeCustomTask(progress: PlanProgress, id: string): PlanProgress {
  const task = progress.custom.find(c => c.id === id);
  const done = { ...progress.done };
  if (task) delete done[taskKey(task.windowId, task.text)];
  return { done, custom: progress.custom.filter(c => c.id !== id) };
}
