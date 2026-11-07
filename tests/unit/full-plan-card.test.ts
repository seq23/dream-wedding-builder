import { describe, expect, it } from 'vitest';
import { FREE_TASK_COUNT, FULL_TASK_COUNT } from '@/components/FullPlanCard';
import { PLAN_WINDOWS } from '@/lib/dated-plan';
import { productById } from '@/lib/products';

// The free plan's end card (her yes 7 Nov 2026) sells the full plan at the prices approved
// 6 Nov 2026 ($9 PDF, $39 bundle) and counts the free tasks from the plan itself.
describe('full plan card', () => {
  it('counts the free tasks from the plan windows, fewer than the full plan', () => {
    expect(FREE_TASK_COUNT).toBe(PLAN_WINDOWS.flatMap((w) => w.tasks).length);
    expect(FREE_TASK_COUNT).toBeGreaterThan(0);
    expect(FREE_TASK_COUNT).toBeLessThan(FULL_TASK_COUNT);
  });
  it('sells through the existing checkout products at the approved prices', () => {
    expect(productById('checklist-pdf')?.price).toBe(9);
    expect(productById('operations-suite')?.price).toBe(39);
  });
});
