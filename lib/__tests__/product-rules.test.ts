import { describe, it, expect } from 'vitest';
import { categories } from '@/data/categories';
import { disclaimers } from '@/data/disclaimers';

describe('product rules', () => {
  it('keeps estimates as ranges with confidence labels', () => {
    expect(categories.length).toBeGreaterThan(5);
    for (const category of categories) {
      expect(category.estimate.low).toBeLessThanOrEqual(category.estimate.likely);
      expect(category.estimate.likely).toBeLessThanOrEqual(category.estimate.high);
      expect(category.estimate.confidence).toBeTruthy();
      expect(category.estimate.plannerWarning).toBeTruthy();
    }
  });
  it('includes required disclaimers', () => {
    expect(disclaimers.cost).toContain('planning estimates');
    expect(disclaimers.retailer).toContain('not endorsements');
    // A photo can reach an AI provider when she ticks the box (the journey, 13 Nov 2026); the notice still warns about private details.
    expect(disclaimers.upload).toContain('anything private');
    expect(disclaimers.professional).toContain('not a substitute');
  });
});
