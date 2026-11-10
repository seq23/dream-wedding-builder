// The one reader for the plan a couple saved in this browser. The planner, the
// dashboard and the printable packet all read it here, because a raw JSON.parse on
// three pages meant one corrupt or older-shaped blob turned every one of them into
// Next's "Application error" white screen (hostile review, 6 Nov 2026: `{bad` in
// dwb-plan crashed /dashboard and /pack; `selectedTrends: null` crashed the planner
// too). A bad blob reads as an empty plan; a field of the wrong type falls back to
// its empty default; everything that parses keeps the couple's work.
import { emptyPlan, type WeddingPlan } from '@/data/planning';

export const PLAN_KEY = 'dwb-plan';
export const SCOPE_KEY = 'dwb-scope';

export interface SavedScope { category?: string; description?: string; scopeTitle?: string; tableCount?: string }

export function normalizePlan(raw: unknown): WeddingPlan {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...emptyPlan };
  const source = raw as Record<string, unknown>;
  const plan: Record<string, unknown> = { ...emptyPlan };
  for (const [key, fallback] of Object.entries(emptyPlan)) {
    const value = source[key];
    if (value === undefined) continue;
    if (Array.isArray(fallback)) plan[key] = Array.isArray(value) ? value.filter(item => typeof item === 'string') : fallback;
    else if (typeof fallback === 'string') plan[key] = typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : fallback;
    else if (key === 'recommendationResult') plan[key] = isRecommendation(value) ? value : null;
    else if (key === 'aiDraft') plan[key] = isAiDraft(value) ? value : null;
    else plan[key] = value;
  }
  return plan as unknown as WeddingPlan;
}

function isAiDraft(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  const strings = (v: unknown) => Array.isArray(v) && v.every(item => typeof item === 'string');
  return typeof r.at === 'string' && typeof r.description === 'string' && strings(r.fields) && strings(r.notes);
}

function isRecommendation(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return typeof r.plannerRead === 'string' && ['bestFitDirections', 'constraintConflicts', 'budgetImplications', 'vendorQuestions', 'nextDecisionChecklist'].every(key => Array.isArray(r[key]));
}

export function parsePlan(text: string | null): WeddingPlan {
  if (!text) return { ...emptyPlan };
  try { return normalizePlan(JSON.parse(text)); } catch { return { ...emptyPlan }; }
}

export function parseScope(text: string | null): SavedScope {
  if (!text) return {};
  try {
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== 'object') return {};
    const out: SavedScope = {};
    for (const key of ['category', 'description', 'scopeTitle', 'tableCount'] as const) if (typeof raw[key] === 'string') out[key] = raw[key];
    return out;
  } catch { return {}; }
}

type StorageLike = Pick<Storage, 'getItem'>;

export function loadSavedPlan(storage: StorageLike): WeddingPlan {
  try { return parsePlan(storage.getItem(PLAN_KEY)); } catch { return { ...emptyPlan }; }
}

export function loadSavedScope(storage: StorageLike): SavedScope {
  try { return parseScope(storage.getItem(SCOPE_KEY)); } catch { return {}; }
}

/**
 * The one writer. The planner calls it after every change, so reload, the back button
 * and the printed plan always show what she last typed (hostile review, 10 Nov 2026:
 * edits were lost unless she found a Save button that confirmed nothing). Returns
 * false when the browser refuses storage, so the page can say so instead of implying
 * it saved.
 */
export function savePlan(storage: Pick<Storage, 'setItem'>, plan: WeddingPlan): boolean {
  try { storage.setItem(PLAN_KEY, JSON.stringify(plan)); return true; } catch { return false; }
}
