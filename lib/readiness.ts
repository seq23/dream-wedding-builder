// The planning readiness score, extracted so exactly one definition exists.
//
// It used to live inline in data/planning.ts and was read only by the planner
// component. The moment a page publishes the rubric, two copies of the arithmetic
// is a guarantee of drift, so the rubric page imports these records and renders
// them - it does not restate them in prose.
//
// This module deliberately does NOT import WeddingPlan from data/planning.ts.
// data/planning.ts re-exports derivePlanReadiness from here, and a type import
// back the other way would make the two modules circular. The structural input
// type below is the narrow contract: any object carrying these fields scores.

export type ReadinessInput = {
  constraintMode?: string;
  locations?: string;
  guestCount?: string;
  budgetTarget?: string;
  budgetMode?: string;
  ownVibeWords?: string;
  colorsLoved?: string;
  priorities?: string[];
  recommendationResult?: unknown;
  selectedVenueIds?: string[];
  selectedVendorCategories?: string[];
};

export interface ReadinessCheck {
  id: string;
  /** Short name used in the planner UI and the published rubric. */
  label: string;
  /** The question the check actually answers, in the couple's words. */
  question: string;
  /** Which plan fields satisfy it. Named so the rubric page can print them. */
  fields: string[];
  /** Why an unanswered version of this blocks a real decision. */
  why: string;
  met: (plan: ReadinessInput) => boolean;
}

// Order is the order the planner asks for them, and the order the rubric prints.
export const readinessChecks: ReadinessCheck[] = [
  {
    id: 'constraint-mode',
    label: 'Constraint mode chosen',
    question: 'Are your requirements hard, flexible, or still being discovered?',
    fields: ['constraintMode'],
    why: 'Every later tradeoff is scored against this. Without it the planner cannot tell a preference from a requirement.',
    met: (plan) => Boolean(plan.constraintMode)
  },
  {
    id: 'location',
    label: 'Location named',
    question: 'Where, roughly, is this happening?',
    fields: ['locations'],
    why: 'Location sets travel cost, season risk, vendor supply, and whether a rain plan is a line item or an afterthought.',
    met: (plan) => Boolean(plan.locations)
  },
  {
    id: 'guest-count',
    label: 'Guest count entered',
    question: 'How many people are you actually feeding and seating?',
    fields: ['guestCount'],
    why: 'Guest count is the multiplier on nearly every quote you will receive. Nothing below it can be estimated without it.',
    met: (plan) => Boolean(plan.guestCount)
  },
  {
    id: 'budget-position',
    label: 'Budget position set',
    question: 'Do you have a target number, or are you still unsure?',
    fields: ['budgetTarget', 'budgetMode'],
    why: 'Saying "unknown" out loud counts. An unstated budget and an admitted-unknown budget are different planning states, and only one of them can be worked with.',
    // budgetMode defaults to the literal string 'unknown' on a new plan, so this
    // check is satisfied from the first render. That is deliberate and it is why
    // an untouched plan scores 11% rather than 0% - see /readiness-score.
    met: (plan) => Boolean(plan.budgetTarget || plan.budgetMode)
  },
  {
    id: 'design-language',
    label: 'Design language started',
    question: 'What should it feel like, or what colours are you drawn to?',
    fields: ['ownVibeWords', 'colorsLoved'],
    why: 'Vendors quote against a described look. Without one you get generic packages and compare them badly.',
    met: (plan) => Boolean(plan.ownVibeWords || plan.colorsLoved)
  },
  {
    id: 'priorities',
    label: 'Priorities protected',
    question: 'What are you unwilling to cut?',
    fields: ['priorities'],
    why: 'When the budget is short, this is the list that decides what survives. Deciding it under pressure is how couples regret cuts.',
    met: (plan) => (plan.priorities ?? []).length >= 1
  },
  {
    id: 'recommendation',
    label: 'Recommendation run',
    question: 'Have you put one real question through the Recommendation Studio?',
    fields: ['recommendationResult'],
    why: 'The recommendation is where your constraints get read back to you, including the conflicts you did not notice you had entered.',
    met: (plan) => Boolean(plan.recommendationResult)
  },
  {
    id: 'venue-shortlist',
    label: 'Venue type shortlisted',
    question: 'Have you shortlisted at least one venue shape?',
    fields: ['selectedVenueIds'],
    why: 'A shortlist of one is still a shortlist. It converts an open search into a comparison you can finish.',
    met: (plan) => (plan.selectedVenueIds ?? []).length >= 1
  },
  {
    id: 'vendor-categories',
    label: 'Vendor categories selected',
    question: 'Which vendor roles are you actually hiring?',
    fields: ['selectedVendorCategories'],
    why: 'The vendor list is the inquiry list. Until it exists there is nobody to send questions to.',
    met: (plan) => (plan.selectedVendorCategories ?? []).length >= 1
  }
];

/** Every check carries the same weight. Nine checks, so one check moves the score by this much. */
export const READINESS_CHECK_COUNT = readinessChecks.length;
export const READINESS_POINTS_PER_CHECK = 100 / READINESS_CHECK_COUNT;

export function readinessBreakdown(plan: ReadinessInput) {
  return readinessChecks.map((check) => ({ ...check, satisfied: check.met(plan) }));
}

export function derivePlanReadiness(plan: ReadinessInput): number {
  const satisfied = readinessChecks.filter((check) => check.met(plan)).length;
  return Math.round((satisfied / readinessChecks.length) * 100);
}

/**
 * What a number means. These are planning-state descriptions, not predictions:
 * the score measures how much of the plan has been decided, and claims nothing
 * about whether the decisions are good ones.
 */
export const readinessBands = [
  { min: 0, max: 22, name: 'Blank', meaning: 'Nothing is decided yet. A new plan opens at 11% because admitting the budget is unknown already counts as a stated position.' },
  { min: 23, max: 44, name: 'Sketched', meaning: 'You have a place and a size. Enough to reject obviously wrong venues, not enough to price anything.' },
  { min: 45, max: 66, name: 'Costed', meaning: 'Location, count, budget position, and what you refuse to cut are all on record. Quotes can now be compared against something.' },
  { min: 67, max: 88, name: 'Actionable', meaning: 'A recommendation has been run against your real constraints and a shortlist exists. This is the point where sending inquiries stops wasting your time.' },
  { min: 89, max: 100, name: 'Complete', meaning: 'Every input the planner scores has been answered. Completeness of inputs, not a verdict on the plan.' }
] as const;

export function readinessBand(score: number) {
  return readinessBands.find((band) => score >= band.min && score <= band.max) ?? readinessBands[0];
}
