// What a fresh install sees first. app/index.tsx routes with firstRoute, and the first step
// of that screen (app/feel.tsx) shows NO_ACCOUNT_LINE; test/firstScreen.unit.ts holds both.
// The claim is true today: no account, no ads SDK (docs/app-privacy.md), and /privacy says
// we never sell your email or your plan. It never says "no tracking".
export const NO_ACCOUNT_LINE = 'Free, with no account or email. No vendor ads, and we never sell your plan.';
/** No saved date (a fresh install) starts the free journey; a saved plan opens the plan. */
export function firstRoute(savedDate: string | null): '/feel' | '/plan' { return savedDate === null ? '/feel' : '/plan'; }
