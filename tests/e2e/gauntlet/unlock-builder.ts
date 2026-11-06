import { expect, type Page } from '@playwright/test';
import { BUILDER_ACCESS_KEY } from '../../../lib/builder-signup';

/** Marks this browser as having already given its email, so builder specs test the builder itself. */
export async function unlockBuilder(page: Page) {
  await page.addInitScript((key) => { try { localStorage.setItem(key, 'e2e'); } catch {} }, BUILDER_ACCESS_KEY);
}

/**
 * Opens folded Builder steps the way a couple does: by tapping "Open this step".
 * Steps 2-7 start closed (collapsible steps, 6 Nov 2026); asserts each one opened.
 */
export async function openSteps(page: Page, ...ids: string[]) {
  for (const id of ids) {
    const toggle = page.getByTestId(`fold-toggle-${id}`);
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(`#${id}-body`)).toBeVisible();
  }
}
