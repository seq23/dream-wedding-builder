import { test, expect } from '@playwright/test';

// 10 Nov 2026: plan first, email second. A stranger gets her dated plan with no
// email; the email is asked inline for the printable plan (and the AI draft), and the
// marketing box is optional and unticked.
test('a stranger sees her dated plan from one field, with no email asked', async ({ page }) => {
  let signups = 0;
  await page.route('**/api/builder-signup', route => { signups++; return route.fulfill({ json: { ok: true } }); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/free-wedding-planner');
  await expect(page.getByTestId('builder-email-gate')).toHaveCount(0);
  await expect(page.getByTestId('wedding-date')).toBeInViewport();
  const d = new Date(); d.setMonth(d.getMonth() + 10);
  await page.getByTestId('wedding-date').fill(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`);
  await expect(page.getByTestId('dated-plan')).toHaveAttribute('data-state', 'future');
  await expect(page.getByTestId('dated-task-toggle').first()).toBeVisible();
  await page.getByTestId('dated-task-toggle').first().click();
  await page.reload();
  await expect(page.getByTestId('dated-plan-progress')).toContainText('1 of');
  expect(signups).toBe(0);
});

test('the printable plan asks for an email once, with an optional unticked marketing box', async ({ page }) => {
  let posted: Record<string, unknown> | null = null;
  await page.route('**/api/builder-signup', async (route) => { posted = route.request().postDataJSON(); await route.fulfill({ json: { ok: true } }); });
  await page.goto('/pack');
  const ask = page.getByTestId('builder-email-gate');
  await expect(ask).toBeVisible();
  await expect(page.getByTestId('pack-page')).toHaveCount(0);
  await expect(page.getByTestId('builder-consent')).not.toBeChecked();
  await page.getByTestId('builder-email-submit').click();
  await expect(ask.getByRole('alert')).toContainText(/valid email/i);
  expect(posted).toBeNull();
  await page.getByTestId('builder-email').fill('couple@example.com');
  await page.getByTestId('builder-email-submit').click();
  await expect(page.getByTestId('pack-page')).toBeVisible();
  expect(posted).toMatchObject({ email: 'couple@example.com', marketing: false });
  await page.reload();
  await expect(page.getByTestId('builder-email-gate')).toHaveCount(0);
  await expect(page.getByTestId('pack-page')).toBeVisible();
});

test('homepage leads with the $9 checklist and its checkout form', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Wedding Checklist PDF \(\$9\)/);
  const cta = page.getByTestId('home-primary-cta');
  await expect(cta.locator('input[name="sku"]')).toHaveValue('DWB-CHECKLIST-001');
  await expect(cta.getByRole('button')).toContainText('$9');
  await expect(page.getByTestId('bundle')).toContainText('Bought separately');
});

test('a link to a planner step lands on that step, with no email asked', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/free-wedding-planner#step-3');
  await expect(page.getByTestId('builder-email-gate')).toHaveCount(0);
  await expect(page.getByTestId('budget-target')).toBeInViewport();
});
