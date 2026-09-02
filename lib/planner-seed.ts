// Seeding contract for /free-wedding-planner.
//
// A landing page answers one planning question completely, then hands the reader
// into the planner with that page's constraint already entered. The handoff is a
// query string, because the planner has no server and no account: everything it
// knows lives in localStorage.
//
// Two rules make this a lead magnet rather than a link:
//
//   1. A seed NEVER overwrites work. Hydration fills only fields the saved plan
//      left empty. A couple who entered 140 guests last week and then reads the
//      "80 guests" page keeps 140. Skipped fields are reported, not silently lost.
//   2. A seed NEVER breaks the planner. Every value is validated against the same
//      option lists the planner's own controls use. Anything unrecognised is
//      dropped and the page renders exactly as it would with no query string at
//      all. There is no error state, because a malformed inbound link is not the
//      reader's problem.
//
// Every accepted value is validated against the live option arrays in
// data/planning.ts - imported, not restated - so a seed can never carry a value
// the planner cannot display.

import { plannerBuckets, priorityOptions, venueTypeOptions, budgetModes, type PlannerBucket, type WeddingPlan } from '@/data/planning';

export const PLANNER_ROUTE = '/free-wedding-planner';
/** Where the floating planner pill remembers a reader's dismissal. Lives here, not
 *  in the component, so a plain Node or Playwright process can name it without
 *  importing React. */
export const PLANNER_PILL_DISMISS_KEY = 'dwb-planner-pill-dismissed';
export const PLANNER_ABSOLUTE = `https://weddingchecklistpdf.com${PLANNER_ROUTE}`;

/** The query keys the planner understands. Anything else in the URL is ignored. */
export const SEED_KEYS = ['guests', 'budget', 'budgetmode', 'mode', 'months', 'location', 'season', 'venue', 'protect', 'focus', 'q'] as const;
export type SeedKey = (typeof SEED_KEYS)[number];
export type PlannerSeed = Partial<Record<SeedKey, string>>;

const constraintModes = ['hard', 'flexible', 'discovery'];
const budgetModeIds = budgetModes.map((mode) => mode.id);

/**
 * Fields whose default value is a real string rather than an empty one. A plan
 * sitting on one of these has not been edited by a person, so a seed may fill it.
 * budgetMode ships as 'unknown' and recommendationFocus as 'Full concept'; without
 * this list a seed would refuse to touch either, forever.
 */
const untouchedDefaults: Partial<Record<keyof WeddingPlan, string>> = {
  budgetMode: 'unknown',
  recommendationFocus: 'Full concept'
};

function digits(value: string, max: number): string | null {
  const cleaned = value.replace(/[^0-9]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > max) return null;
  return String(parsed);
}

/**
 * Turn a query string into a plan patch. Pure, synchronous, and total: it throws
 * for no input, and returns an empty patch when nothing is recognised.
 */
export function planPatchFromSeed(input: URLSearchParams | PlannerSeed | string): Partial<WeddingPlan> {
  const patch: Partial<WeddingPlan> = {};
  let params: URLSearchParams;
  try {
    if (typeof input === 'string') params = new URLSearchParams(input);
    else if (input instanceof URLSearchParams) params = input;
    else params = new URLSearchParams(Object.entries(input).filter(([, value]) => typeof value === 'string') as [string, string][]);
  } catch {
    return patch;
  }

  const read = (key: SeedKey) => {
    const raw = params.get(key);
    return typeof raw === 'string' ? raw.trim().slice(0, 200) : '';
  };

  const guests = digits(read('guests'), 5000);
  if (guests) patch.guestCount = guests;

  const budget = digits(read('budget'), 10_000_000);
  if (budget) patch.budgetTarget = budget;

  const budgetmode = read('budgetmode').toLowerCase();
  if (budgetModeIds.includes(budgetmode)) patch.budgetMode = budgetmode;

  const mode = read('mode').toLowerCase();
  if (constraintModes.includes(mode)) patch.constraintMode = mode as WeddingPlan['constraintMode'];

  // The planner has no date field - it reasons in constraints - so a remaining
  // months figure is entered as the constraint sentence a person would type.
  const months = digits(read('months'), 60);
  if (months) patch.constraints = `${months} month${months === '1' ? '' : 's'} until the wedding date.`;

  const location = read('location');
  if (location) patch.locations = location;

  const season = read('season');
  if (/^(spring|summer|autumn|fall|winter)$/i.test(season)) patch.season = season.toLowerCase();

  // Venue types are multi-select in the planner, so a seed may name several.
  const venues = read('venue').split(',').map((item) => item.trim().toLowerCase()).filter((item) => venueTypeOptions.includes(item));
  if (venues.length) patch.venueTypes = [...new Set(venues)];

  const protectLower = new Map(priorityOptions.map((option) => [option.toLowerCase(), option]));
  const protectedItems = read('protect').split(',').map((item) => protectLower.get(item.trim().toLowerCase())).filter((item): item is string => Boolean(item));
  if (protectedItems.length) patch.priorities = [...new Set(protectedItems)];

  const focus = read('focus');
  const matchedFocus = plannerBuckets.find((bucket) => bucket.toLowerCase() === focus.toLowerCase());
  if (matchedFocus) patch.recommendationFocus = matchedFocus as PlannerBucket;

  const question = read('q');
  if (question) patch.recommendationQuestion = question;

  return patch;
}

function isEmptyValue(key: keyof WeddingPlan, value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    if (!value.trim()) return true;
    return untouchedDefaults[key] === value;
  }
  return false;
}

export interface SeedApplication<T> {
  plan: T;
  /** Fields the seed actually filled. Empty means the seed changed nothing. */
  applied: (keyof WeddingPlan)[];
  /** Fields the seed carried but did not write, because the reader already had a value there. */
  skipped: (keyof WeddingPlan)[];
}

/**
 * Merge a seed patch into an existing plan without destroying anything. Only
 * fields that are still at their untouched default are written.
 */
export function applySeed<T extends object>(plan: T, patch: Partial<WeddingPlan>): SeedApplication<T> {
  const applied: (keyof WeddingPlan)[] = [];
  const skipped: (keyof WeddingPlan)[] = [];
  const next = { ...plan } as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    const field = key as keyof WeddingPlan;
    if (value === undefined) continue;
    if (isEmptyValue(field, next[key])) {
      next[key] = value;
      applied.push(field);
    } else {
      skipped.push(field);
    }
  }
  return { plan: next as T, applied, skipped };
}

/** Human-readable field names for the "seeded from" notice the planner shows. */
export const seedFieldLabels: Partial<Record<keyof WeddingPlan, string>> = {
  guestCount: 'guest count',
  budgetTarget: 'budget target',
  budgetMode: 'budget position',
  constraintMode: 'constraint mode',
  constraints: 'timing constraint',
  locations: 'location',
  season: 'season',
  venueTypes: 'venue types',
  priorities: 'protected priorities',
  recommendationFocus: 'studio focus',
  recommendationQuestion: 'studio question'
};

/** Build a planner URL carrying a seed. Used by every landing page and guide. */
export function plannerHref(seed: PlannerSeed, options: { absolute?: boolean; hash?: string } = {}): string {
  const params = new URLSearchParams();
  for (const key of SEED_KEYS) {
    const value = seed[key];
    if (typeof value === 'string' && value.trim()) params.set(key, value.trim());
  }
  const query = params.toString();
  const base = options.absolute ? PLANNER_ABSOLUTE : PLANNER_ROUTE;
  return `${base}${query ? `?${query}` : ''}${options.hash ?? ''}`;
}

// --- Guides ------------------------------------------------------------------
//
// A guide's seed is derived from the guide's own record - its cluster, and any
// number the slug already states - rather than from a hand-maintained mapping
// table that would drift the moment a guide is added. A guide that states no
// number still seeds a studio focus, so the entry is never generic.

const clusterFocus: Record<string, PlannerBucket> = {
  'Wedding budget': 'Budget + Tradeoffs',
  'Wedding timeline': 'Timeline / Weekend Flow',
  'Wedding seating chart': 'Guest Experience / Hospitality',
  'Wedding checklist': 'Full concept'
};

export function seedFromGuide(guide: { slug: string; title: string; cluster: string }): PlannerSeed {
  const seed: PlannerSeed = {};
  const focus = clusterFocus[guide.cluster];
  if (focus) seed.focus = focus;
  const guests = guide.slug.match(/(\d+)-guests?/);
  if (guests) seed.guests = guests[1];
  const months = guide.slug.match(/(\d+)-months?/);
  if (months) seed.months = months[1];
  // The guide's own title is the question the reader already asked, so it becomes
  // the Recommendation Studio prompt verbatim rather than an invented one.
  seed.q = guide.title;
  return seed;
}

/** The label the guide's planner entry and floating pill both use. */
export function plannerLabelForGuide(guide: { title: string; slug: string }): string {
  const months = guide.slug.match(/(\d+)-months?/);
  if (months) return `Build your ${months[1]}-month plan →`;
  const guests = guide.slug.match(/(\d+)-guests?/);
  if (guests) return `Build this around your ${guests[1]} guests →`;
  return `Build this ${guide.title.toLowerCase()} around your actual date →`;
}
