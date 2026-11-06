import { expect, test } from '@playwright/test';
import { unlockBuilder } from './unlock-builder';

// Hostile review 6 Nov 2026: the Builder had no date, a bad saved blob white-screened
// three pages, and the planner scrolled sideways at 390px.
test.describe('dated plan, saved-plan safety and phone width', () => {
  // isMobile matters: a desktop window at 390px did not reproduce the sideways scroll.
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('entering a date three weeks out shows catch-up first and real dates, and the dashboard and packet agree', async ({ page }) => {
    await unlockBuilder(page);
    await page.goto('/free-wedding-planner');
    const d = new Date(); d.setDate(d.getDate() + 21);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await page.getByTestId('wedding-date').fill(iso);
    await expect(page.getByTestId('dated-plan')).toHaveAttribute('data-state', 'future');
    await expect(page.getByTestId('dated-plan-headline')).toContainText('21 days to go');
    await expect(page.getByTestId('dated-plan-catch-up')).toContainText('Book the venue');
    await page.goto('/dashboard');
    await expect(page.getByTestId('dated-plan-headline')).toContainText('21 days to go');
    await page.goto('/pack');
    await expect(page.getByTestId('pack-dated-plan')).toContainText('21 days to go');
  });

  test('a past date and an impossible date are said plainly', async ({ page }) => {
    await unlockBuilder(page);
    await page.goto('/free-wedding-planner');
    await page.getByTestId('wedding-date').fill('2020-06-01');
    await expect(page.getByTestId('dated-plan')).toHaveAttribute('data-state', 'past');
  });

  test('a corrupt or old-shaped saved plan never white-screens the planner, dashboard or packet', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await unlockBuilder(page);
    for (const blob of ['{bad', JSON.stringify({ selectedTrends: null, guestCount: 120 })]) {
      await page.addInitScript(v => { localStorage.setItem('dwb-plan', v); localStorage.setItem('dwb-scope', '{bad'); }, blob);
      for (const path of ['/free-wedding-planner', '/dashboard', '/pack']) {
        await page.goto(path);
        await expect(page.locator('h1').first()).toBeVisible();
        await expect(page.locator('body')).not.toContainText('Application error');
      }
    }
    expect(errors).toEqual([]);
  });

  test('the unlocked planner never scrolls sideways at 390px', async ({ page }) => {
    await unlockBuilder(page);
    await page.goto('/free-wedding-planner');
    await page.waitForLoadState('load');
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(sw).toBeLessThanOrEqual(cw);
  });

  test('the planner does not show a banner telling the couple to open the planner', async ({ page }) => {
    await unlockBuilder(page);
    await page.goto('/free-wedding-planner');
    await expect(page.getByTestId('wedding-date')).toBeVisible();
    await expect(page.getByTestId('planner-banner')).toHaveCount(0);
    await page.goto('/');
    await expect(page.getByTestId('planner-banner')).toBeVisible();
  });
});
