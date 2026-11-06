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
    else plan[key] = value;
  }
  return plan as unknown as WeddingPlan;
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
