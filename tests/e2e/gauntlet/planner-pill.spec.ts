import { test, expect } from '@playwright/test';
import { PLANNER_PILL_DISMISS_KEY } from '../../../lib/planner-seed';

// The persistent planner entry, proved in a browser.
//
// Two claims that only a browser can settle: the pill does not interrupt the
// answer someone arrived for, and dismissing it actually sticks. A dismiss that
// does not persist is worse than no dismiss - it teaches the reader the control
// is fake.

const GUIDE = '/guides/1-month-wedding-checklist';

test('the always-on planner banner is on every page type', async ({ page }) => {
  for (const path of ['/', '/guides', GUIDE, '/wedding-cost-per-guest', '/methodology', '/readiness-score', '/trends']) {
    await page.goto(path);
    await expect(page.getByTestId('planner-banner'), `${path} has no persistent planner entry`).toBeVisible();
    await expect(page.getByTestId('planner-banner').getByRole('link')).toHaveAttribute('href', /free-wedding-planner/);
  }
});

test('the pill stays out of the way until the reader is well into the page', async ({ page }) => {
  await page.goto(GUIDE);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('planner-pill')).toHaveCount(0);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.6));
  await expect(page.getByTestId('planner-pill')).toBeVisible();
  // It carries this page's own seed rather than a generic link.
  await expect(page.getByTestId('planner-pill-link')).toHaveAttribute('href', /\/free-wedding-planner\?/);
});

test('dismissing the pill suppresses it on the next page load', async ({ page }) => {
  await page.goto(GUIDE);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.6));
  await expect(page.getByTestId('planner-pill')).toBeVisible();

  await page.getByTestId('planner-pill-dismiss').click();
  await expect(page.getByTestId('planner-pill')).toHaveCount(0);

  const stored = await page.evaluate((key) => window.localStorage.getItem(key), PLANNER_PILL_DISMISS_KEY);
  expect(stored, 'the dismissal was never written to storage').toBe('1');

  // A fresh load of a different page must still respect it.
  await page.goto('/wedding-cost-per-guest');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.getByTestId('planner-pill'), 'a dismissed pill came back on the next page').toHaveCount(0);
  // The always-on entry is unaffected: dismissing the pill is not opting out of
  // the planner, it is declining one prompt.
  await expect(page.getByTestId('planner-banner')).toBeVisible();
});

test('the pill is suppressed on the planner itself and on purchase surfaces', async ({ page }) => {
  for (const path of ['/free-wedding-planner', '/shop', '/products/checklist-pdf', '/dashboard', '/pack']) {
    await page.goto(path);
    await page.evaluate(() => window.localStorage.clear());
    await page.goto(path);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.getByTestId('planner-pill'), `${path} should not show the pill`).toHaveCount(0);
  }
});

test('the pill is keyboard reachable and screen-reader labelled', async ({ page }) => {
  await page.goto(GUIDE);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.6));
  await expect(page.getByTestId('planner-pill')).toBeVisible();

  await expect(page.getByRole('complementary', { name: 'Free wedding planner' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Dismiss the free wedding planner prompt/i })).toBeVisible();
  await page.getByTestId('planner-pill-link').focus();
  await expect(page.getByTestId('planner-pill-link')).toBeFocused();
});
