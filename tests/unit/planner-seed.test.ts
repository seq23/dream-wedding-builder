import { describe, expect, it } from 'vitest';
import { applySeed, planPatchFromSeed, plannerHref, seedFromGuide, plannerLabelForGuide, SEED_KEYS } from '@/lib/planner-seed';
import { plannerLandings } from '@/data/planner-landings';
import { emptyPlan, derivePlanReadiness } from '@/data/planning';
import { shippingPages } from '@/lib/authority-registry';

// The behavioural half of the seeding guard. The static validator proves the
// links exist; this proves the links do something when followed.

describe('every landing page seed hydrates into the plan', () => {
  it('examines at least one landing page', () => {
    expect(plannerLandings.length).toBeGreaterThan(0);
  });

  for (const landing of plannerLandings) {
    it(`${landing.slug} seeds real plan fields`, () => {
      // The URL the page actually renders, parsed the way the planner parses it.
      const href = plannerHref(landing.seed);
      const query = href.split('?')[1] ?? '';
      expect(query, `${landing.slug} produced a planner link with no seed`).not.toBe('');

      const patch = planPatchFromSeed(query);
      expect(Object.keys(patch).length, `${landing.slug} seed survived none of the validation`).toBeGreaterThan(0);

      const result = applySeed(emptyPlan, patch);
      expect(result.skipped).toEqual([]);
      expect(result.applied.length).toBe(Object.keys(patch).length);
      for (const [key, value] of Object.entries(patch)) {
        expect(result.plan[key as keyof typeof result.plan]).toEqual(value);
      }
      // Hydration must move the plan forward, not merely mutate it.
      expect(derivePlanReadiness(result.plan)).toBeGreaterThanOrEqual(derivePlanReadiness(emptyPlan));
    });
  }
});

describe('a seed never overwrites saved work', () => {
  it('keeps the reader\'s own values and reports what it skipped', () => {
    const saved = { ...emptyPlan, guestCount: '140', locations: 'Sonoma', priorities: ['Photography'] };
    const patch = planPatchFromSeed('guests=80&location=Charleston&protect=Florals&focus=Budget %2B Tradeoffs');
    const result = applySeed(saved, patch);

    expect(result.plan.guestCount).toBe('140');
    expect(result.plan.locations).toBe('Sonoma');
    expect(result.plan.priorities).toEqual(['Photography']);
    expect(result.skipped).toEqual(expect.arrayContaining(['guestCount', 'locations', 'priorities']));
    // Fields the reader never touched are still filled, or the seed would be inert
    // for anyone who has ever opened the planner before.
    expect(result.applied).toContain('recommendationFocus');
    expect(result.plan.recommendationFocus).toBe('Budget + Tradeoffs');
  });

  it('treats the shipped defaults as untouched rather than as answers', () => {
    // budgetMode ships as 'unknown' and recommendationFocus as 'Full concept'.
    // Without this, a seed could never fill either field for anybody.
    const result = applySeed(emptyPlan, planPatchFromSeed('budgetmode=hard&focus=Venue %2B Lodging'));
    expect(result.applied).toEqual(expect.arrayContaining(['budgetMode', 'recommendationFocus']));
    expect(result.plan.budgetMode).toBe('hard');
  });
});

describe('a broken seed silently no-ops', () => {
  const hostile = [
    '',
    'guests=abc',
    'guests=-40',
    'guests=999999999',
    'budget=NaN',
    'mode=<script>alert(1)</script>',
    'focus=Not A Real Bucket',
    'venue=hogwarts',
    'protect=Nothing At All',
    'season=monsoon',
    'months=0',
    'unknownkey=1&anotherunknown=2',
    '%%%',
    'guests=80&guests=90'
  ];
  for (const query of hostile) {
    it(`drops "${query || '(empty)'}" without throwing`, () => {
      const patch = planPatchFromSeed(query);
      const result = applySeed(emptyPlan, patch);
      // Whatever survived must be a real field with a real value; nothing invalid
      // is allowed through, and the planner must still be usable either way.
      for (const value of Object.values(patch)) expect(value).not.toBe('');
      expect(result.plan.stage).toBe(emptyPlan.stage);
      expect(typeof derivePlanReadiness(result.plan)).toBe('number');
    });
  }

  it('rejects every unrecognised value in one hostile string', () => {
    expect(planPatchFromSeed('guests=abc&focus=nonsense&venue=hogwarts&mode=maybe&protect=nothing&season=monsoon')).toEqual({});
  });

  it('only ever emits documented seed keys', () => {
    for (const landing of plannerLandings) {
      for (const key of Object.keys(landing.seed)) {
        expect(SEED_KEYS as readonly string[]).toContain(key);
      }
    }
  });
});

describe('every shipping guide seeds the planner', () => {
  it('examines the whole shipping set', () => {
    expect(shippingPages.length).toBeGreaterThan(0);
  });

  it('produces a non-empty seed and a specific label for every guide', () => {
    const inert: string[] = [];
    for (const page of shippingPages) {
      const seed = seedFromGuide(page);
      const patch = planPatchFromSeed(plannerHref(seed).split('?')[1] ?? '');
      if (Object.keys(patch).length === 0) inert.push(page.slug);
      expect(plannerLabelForGuide(page).trim().length).toBeGreaterThan(0);
    }
    expect(inert).toEqual([]);
  });
});
