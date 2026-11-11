import { describe, expect, it } from 'vitest';
import { budgetReality, emptyPlan, type WeddingPlan } from '@/data/planning';
import { budgetHeadline, budgetPlan, budgetSubline, parseMoney } from '@/lib/budget-plan';

// Hostile review, 10 Nov 2026: she said "$30,000" and the planner's headline read
// "$66,000-$150,000". Her number is the headline, the split is built inside it, and
// the planner says so when her own numbers do not fit.
const draft: WeddingPlan = { ...emptyPlan, guestCount: '120', locations: 'Memphis', budgetTarget: '$30,000', budgetMode: 'hard', priorities: ['Party Energy', 'Food + Bar'] };

describe('her stated budget drives every number', () => {
  it('absorbs rounding overflow without changing her own amounts or exceeding the limit', () => {
    for (const input of [
      { budgetTarget: '381' },
      { budgetTarget: '30000', venueBudget: '29807' },
      ...Array.from({ length: 500 }, (_, i) => ({ budgetTarget: String(i + 1) }))
    ]) {
      const result = budgetPlan(input);
      expect(result.lines.reduce((sum, line) => sum + line.amount, 0)).toBe(result.limit);
      expect(result.lines.every(line => line.amount >= 0)).toBe(true);
      if ('venueBudget' in input) expect(result.lines.find(line => line.id === 'venue-food-drink')?.amount).toBe(29807);
      expect(result.over).toBe(0);
    }
  });
  it('reads the budget however she or the AI draft wrote it', () => {
    expect(parseMoney('$30,000')).toBe(30000);
    expect(parseMoney('about 30k')).toBe(30000);
    expect(parseMoney('30000')).toBe(30000);
    expect(parseMoney('$25,000-$30,000')).toBe(30000);
    expect(parseMoney('small budget')).toBe(0);
  });

  it('$30,000 in shows $30,000, never a larger range, and the split adds up to it', () => {
    expect(budgetHeadline(draft)).toBe('$30,000');
    expect(budgetSubline(draft)).toContain('$250 a guest');
    const b = budgetPlan(draft);
    expect(b.lines.reduce((sum, line) => sum + line.amount, 0)).toBe(30000);
    expect(Math.max(...b.lines.map(line => line.amount))).toBeLessThan(30000);
    expect(b.warnings).toEqual([]);
    // Nothing on any surface may exceed her number.
    for (const text of [budgetHeadline(draft), budgetSubline(draft), budgetReality(draft)]) for (const n of text.match(/\$[\d,]+/g) ?? []) expect(parseMoney(n)).toBeLessThanOrEqual(30000);
  });

  it('typing a hard limit under the budget pulls the headline and the split down to it', () => {
    const capped = { ...draft, hardCeiling: '28000' };
    expect(budgetHeadline(capped)).toBe('$28,000');
    const b = budgetPlan(capped);
    expect(b.lines.reduce((sum, line) => sum + line.amount, 0)).toBe(28000);
    expect(b.warnings[0]).toContain('$2,000 over your hard limit');
  });

  it('says plainly when her own numbers pass the budget, and names an unprotected line to lower', () => {
    const over = budgetPlan({ ...draft, venueBudget: '$22,000', floralDecorBudget: '9000', photoVideoBudget: '4,000' });
    expect(over.over).toBe(5000);
    expect(over.warnings[0]).toContain('$5,000 over your hard budget of $30,000');
    // Food + Bar is protected, so the venue-and-food line is not the first cut offered.
    expect(over.warnings[0]).toContain('Lower Flowers, decor and rentals ($9,000)');
    expect(over.warnings[0]).not.toContain('Lower Venue');
  });

  it('leans the split toward what she said matters most', () => {
    const plain = budgetPlan({ ...draft, priorities: [] }).lines.find(l => l.id === 'music')!.amount;
    const leaned = budgetPlan(draft).lines.find(l => l.id === 'music')!.amount;
    expect(leaned).toBeGreaterThan(plain);
  });

  it('no number means no number: nothing is invented from the guest count', () => {
    const none = { ...emptyPlan, guestCount: '120' };
    expect(budgetHeadline(none)).toBe('Not set yet');
    expect(budgetPlan(none).lines).toEqual([]);
    expect(budgetReality(none)).not.toMatch(/\$\d/);
    expect(budgetHeadline({ ...none, budgetTarget: 'small budget' })).toBe('small budget');
  });
});
