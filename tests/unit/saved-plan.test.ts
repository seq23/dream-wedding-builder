import { describe, expect, it } from 'vitest';
import { emptyPlan } from '@/data/planning';
import { loadSavedPlan, parsePlan, parseScope, savePlan } from '@/lib/saved-plan';
import { readFileSync } from 'node:fs';

describe('saved plan reader (a bad blob never white-screens the planner, dashboard or packet)', () => {
  it('corrupt JSON reads as an empty plan', () => {
    expect(parsePlan('{bad')).toEqual(emptyPlan);
    expect(parseScope('{bad')).toEqual({});
  });

  it('null or wrong-type fields fall back to their defaults; good fields are kept', () => {
    const plan = parsePlan(JSON.stringify({ selectedTrends: null, priorities: 'x', guestCount: 120, locations: 'Memphis', recommendationResult: { plannerRead: 1 } }));
    expect(plan.selectedTrends).toEqual([]);
    expect(plan.priorities).toEqual([]);
    expect(plan.guestCount).toBe('120');
    expect(plan.locations).toBe('Memphis');
    expect(plan.recommendationResult).toBeNull();
    expect(() => plan.selectedTrends.includes('a')).not.toThrow();
  });

  it('storage that throws (blocked cookies) still returns a plan', () => {
    expect(loadSavedPlan({ getItem: () => { throw new Error('blocked'); } })).toEqual(emptyPlan);
  });

  it('what the planner saves after an edit is what a reload, the dashboard and the printed plan read back', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
    const edited = { ...emptyPlan, guestCount: '150', budgetTarget: '$30,000', selectedVenueIds: ['public-park-garden'] };
    expect(savePlan(storage, edited)).toBe(true);
    expect(loadSavedPlan(storage)).toEqual(edited);
    expect(savePlan({ setItem: () => { throw new Error('blocked'); } }, edited)).toBe(false);
  });

  it('the planner saves on every change, with no Save button to find', () => {
    const src = readFileSync('app/free-wedding-planner/page.tsx', 'utf8');
    expect(src).toMatch(/useEffect\(\(\) => \{\s*if \(!loaded\) return;\s*const ok = savePlan\(localStorage, plan\);[\s\S]*?\}, \[plan, loaded\]\)/);
    expect(src).not.toMatch(/save-guided-plan/);
  });

  it('no page parses the saved plan itself', () => {
    for (const file of ['app/free-wedding-planner/page.tsx', 'app/dashboard/page.tsx', 'app/pack/page.tsx']) {
      const src = readFileSync(file, 'utf8');
      expect(src, file).not.toMatch(/JSON\.parse\(/);
      expect(src, file).toMatch(/loadSavedPlan/);
    }
  });
});
