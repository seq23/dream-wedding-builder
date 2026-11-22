import { test, expect } from '@playwright/test';

// The free checklist sample form (launch kit, 21 Nov 2026): the marketing box is optional and
// unticked, and the hidden honeypot field really reaches the server (a bot that fills it is
// dropped by app/api/sample). Turnstile is replaced by a stub that solves at once.
const TURNSTILE_STUB = `window.turnstile = { render(el, o) { setTimeout(() => o.callback('solved'), 0); return 'w1'; }, reset() {} };`;

async function openForm(page: import('@playwright/test').Page) {
  await page.route('https://challenges.cloudflare.com/turnstile/**', (route) => route.fulfill({ contentType: 'text/javascript', body: TURNSTILE_STUB }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/products/checklist-pdf');
  await expect(page.getByTestId('sample-signup')).toBeVisible();
}

test('sample: the box is unticked, optional, and an unticked request still gets the sample', async ({ page }) => {
  let posted: Record<string, unknown> | null = null;
  await page.route('**/api/sample', async (route) => { posted = route.request().postDataJSON(); await route.fulfill({ json: { ok: true, emailed: true } }); });
  await openForm(page);
  await expect(page.getByTestId('sample-consent')).not.toBeChecked();
  await page.getByTestId('sample-email').fill('couple@example.com');
  await page.getByTestId('sample-submit').click();
  await expect(page.getByTestId('sample-signup')).toContainText('Sent.');
  expect(posted).toMatchObject({ email: 'couple@example.com', consent: false, turnstileToken: 'solved', company: '' });
});

test('sample: a filled honeypot is sent to the server, which drops it', async ({ page }) => {
  let posted: Record<string, unknown> | null = null;
  await page.route('**/api/sample', async (route) => { posted = route.request().postDataJSON(); await route.fulfill({ json: { ok: true } }); });
  await openForm(page);
  await page.getByTestId('sample-email').fill('bot@example.com');
  await page.locator('input[name="company"]').evaluate((el) => { (el as HTMLInputElement).value = 'Acme'; });
  await page.getByTestId('sample-submit').click();
  await expect.poll(() => posted).not.toBeNull();
  expect(posted).toMatchObject({ company: 'Acme' });
});
