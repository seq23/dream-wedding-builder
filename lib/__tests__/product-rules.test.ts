import { describe, it, expect } from 'vitest';
import { categories } from '@/data/categories';
import { trends } from '@/data/trends';
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
  it('includes location-specific trend intelligence', () => {
    expect(trends.some(t => t.id === 'lake-como-color-smoke' && t.locationFit?.includes('Lake Como'))).toBe(true);
  });
  it('includes required disclaimers', () => {
    expect(disclaimers.cost).toContain('planning estimates');
    expect(disclaimers.retailer).toContain('not endorsements');
    expect(disclaimers.upload).toContain('private, sensitive');
    expect(disclaimers.professional).toContain('not a substitute');
  });
});
