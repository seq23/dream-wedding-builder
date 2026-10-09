import type { Page } from '@playwright/test';
import { BUILDER_ACCESS_KEY } from '../../../lib/builder-signup';

/** Marks this browser as having already given its email, so builder specs test the builder itself. */
export async function unlockBuilder(page: Page) {
  await page.addInitScript((key) => { try { localStorage.setItem(key, 'e2e'); } catch {} }, BUILDER_ACCESS_KEY);
}
