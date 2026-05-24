import { test, expect } from '@playwright/test';

test('surface gauntlet: required pages render without auth', async ({ page }) => {
  for (const path of ['/', '/build', '/dashboard', '/trends', '/photos', '/pack', '/disclaimer', '/privacy', '/methodology']) {
    await page.goto(path);
    await expect(page.locator('body')).toContainText(/Dream Wedding|Disclaimer|Privacy|Pricing Methodology/);
    await expect(page.getByText(/Login|Sign in|Create account/i)).toHaveCount(0);
  }
});

test('guided workbook: step-by-step flow handles strict budget escape hatch', async ({ page }) => {
  await page.goto('/build');
  await expect(page.getByTestId('step-vision')).toContainText('What should the wedding feel like?');
  await expect(page.getByText('Step 1: Vision')).toBeVisible();
  await expect(page.getByText('Step 7: Packet')).toBeVisible();
  await page.getByTestId('budget-strict').click();
  await expect(page.getByTestId('strict-copy')).toContainText('warns');
  await expect(page.getByTestId('strict-warning')).toContainText('Budget Warning');
  await page.getByTestId('turn-off-strict').click();
  await expect(page.getByTestId('budget-dream')).toContainText('No Budget / Dream Mode');
});

test('guided workbook: trend concierge is embedded and saves to dashboard', async ({ page }) => {
  await page.goto('/build');
  await expect(page.getByRole('heading', { name: 'Wedding Trend Concierge' })).toBeVisible();
  await page.getByTestId('toggle-trend-gelato-cart').click();
  await page.getByTestId('save-guided-plan').click();
  await page.goto('/dashboard');
  await expect(page.getByText('Gelato Cart')).toBeVisible();
});

test('trend library: add trend and submit idea enters review', async ({ page }) => {
  await page.goto('/trends');
  await expect(page.getByRole('heading', { name: 'Wedding Trend Concierge' })).toBeVisible();
  page.on('dialog', d => d.accept());
  await page.getByTestId('trend-lake-como-color-smoke').getByRole('button', { name: 'Add to Dashboard' }).first().click();
  await page.goto('/dashboard');
  await expect(page.getByText('Lake Como Color Smoke Kiss Moment')).toBeVisible();
  await page.goto('/trends');
  await page.locator('input[name="idea_name"]').fill('Petal champagne escort wall');
  await page.locator('textarea[name="description"]').fill('A styled escort wall with a champagne handoff and floral reveal.');
  await page.locator('textarea[name="why_cool"]').fill('It feels luxe and interactive.');
  await page.getByText('Submit idea').click();
  await expect(page.getByTestId('trend-submit-status')).toContainText('received');
});

test('photo gauntlet: consent required and execution cost distinguished', async ({ page }) => {
  await page.goto('/build');
  await expect(page.getByTestId('analyze-photo')).toBeDisabled();
  await page.setInputFiles('[data-testid="photo-input"]', { name: 'chandelier.png', mimeType: 'image/png', buffer: Buffer.from('fake') });
  await expect(page.getByTestId('analyze-photo')).toBeDisabled();
  await page.getByTestId('photo-consent').check();
  await page.getByTestId('analyze-photo').click();
  await expect(page.getByTestId('photo-results')).toContainText('Retail item price');
  await expect(page.getByTestId('photo-results')).toContainText('Wedding execution estimate');
  await expect(page.getByTestId('photo-results')).toContainText('No fake live vendor/product search is claimed');
});

test('starter pack outcome: print packet includes required sections and disclaimers', async ({ page }) => {
  await page.goto('/build');
  await expect(page.getByTestId('step-pack')).toContainText('Dream Wedding Starter Pack Preview');
  await page.goto('/pack');
  await expect(page.getByText('Dream Wedding Starter Pack')).toBeVisible();
  await expect(page.getByText('Selected Trends & Experience Ideas')).toBeVisible();
  await expect(page.getByText('Vendor Inquiry Draft')).toBeVisible();
  await expect(page.getByText('Estimated costs are planning estimates only')).toBeVisible();
  await expect(page.getByText('not a substitute for a professional wedding planner')).toBeVisible();
});
