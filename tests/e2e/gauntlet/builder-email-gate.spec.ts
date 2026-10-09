import { test, expect } from '@playwright/test';

test('the free builder asks for an email with consent before it opens', async ({ page }) => {
  let posted: Record<string, unknown> | null = null;
  await page.route('**/api/builder-signup', async (route) => {
    posted = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.goto('/free-wedding-planner');
  const gate = page.getByTestId('builder-email-gate');
  await expect(gate).toBeVisible();
  await expect(gate).toContainText(/unsubscribe/i);
  await page.getByTestId('builder-email').fill('couple@example.com');
  await page.getByTestId('builder-email-submit').click();
  await expect(gate.getByRole('alert')).toContainText(/tick the box/i);
  expect(posted).toBeNull();
  await page.getByTestId('builder-consent').check();
  await page.getByTestId('builder-email-submit').click();
  await expect(gate).toHaveCount(0);
  expect(posted).toMatchObject({ email: 'couple@example.com', consent: true });
  await page.reload();
  await expect(page.getByTestId('builder-email-gate')).toHaveCount(0);
});

test('homepage leads with the $9 checklist and its checkout form', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Wedding Checklist PDF \(\$9\)/);
  const cta = page.getByTestId('home-primary-cta');
  await expect(cta.locator('input[name="sku"]')).toHaveValue('DWB-CHECKLIST-001');
  await expect(cta.getByRole('button')).toContainText('$9');
  await expect(page.getByTestId('bundle')).toContainText('Bought separately');
});
