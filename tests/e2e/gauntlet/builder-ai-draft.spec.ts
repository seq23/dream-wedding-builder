import { expect, test } from '@playwright/test';
import { unlockBuilder } from './unlock-builder';

// The AI draft card at 390px with the server mocked: the real limits are proved in
// tests/unit/ai-draft.test.ts; this proves what the couple sees.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const draft = { weddingDate: '', guestCount: '200', locations: 'Memphis, TN', season: 'summer', budgetTarget: 'small', budgetMode: 'hard', priorities: ['Food + Bar'], notes: ['Memphis in June is hot: plan shade and water.'] };

test('a draft fills the plan, is labelled AI-drafted, keeps the couple’s own answers, and cannot be run twice', async ({ page }) => {
  await unlockBuilder(page);
  await page.addInitScript(() => { localStorage.setItem('dwb-builder-email', 'a@example.com'); if (!localStorage.getItem('dwb-plan')) localStorage.setItem('dwb-plan', JSON.stringify({ guestCount: '120' })); });
  const d = new Date(); d.setMonth(d.getMonth() + 8);
  draft.weddingDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`;
  await page.route('**/api/ai-draft', route => route.request().method() === 'GET'
    ? route.fulfill({ json: { enabled: true, maxLength: 400 } })
    : route.fulfill({ json: { ok: true, draft, remaining: 0 } }));
  await page.goto('/free-wedding-planner');
  await page.getByTestId('ai-description').fill('200 guests, June in Memphis, small budget');
  await expect(page.getByTestId('ai-submit')).toBeDisabled();
  await page.getByTestId('ai-consent').check();
  await page.getByTestId('ai-submit').click();
  await expect(page.getByTestId('ai-result')).toContainText('Kept your own answers for: guest count');
  await expect(page.getByTestId('ai-drafted-label')).toContainText('AI-drafted');
  await expect(page.getByTestId('dated-plan')).toHaveAttribute('data-state', 'future');
  await expect(page.getByTestId('ai-submit')).toBeDisabled();
  await page.reload();
  await expect(page.getByTestId('ai-drafted-label')).toContainText('Memphis in June is hot');
  await page.goto('/pack');
  await expect(page.getByTestId('ai-drafted-label')).toBeVisible();
});

test('a busy model shows a calm try-again and leaves the plan as it was', async ({ page }) => {
  await unlockBuilder(page);
  await page.addInitScript(() => localStorage.setItem('dwb-builder-email', 'a@example.com'));
  await page.route('**/api/ai-draft', route => route.request().method() === 'GET'
    ? route.fulfill({ json: { enabled: true, maxLength: 400 } })
    : route.fulfill({ status: 503, json: { ok: false, code: 'BUSY', error: 'AI drafting is busy. Please try again later; you can still build your plan by hand below.' } }));
  await page.goto('/free-wedding-planner');
  await page.getByTestId('ai-description').fill('200 guests, June in Memphis, small budget');
  await expect(page.getByTestId('ai-submit')).toBeDisabled();
  await page.getByTestId('ai-consent').check();
  await page.getByTestId('ai-submit').click();
  await expect(page.getByTestId('ai-message')).toContainText('try again later');
  await expect(page.getByTestId('ai-drafted-label')).toHaveCount(0);
  await expect(page.getByTestId('dated-plan')).toHaveAttribute('data-state', 'none');
});

test('switched off: no AI card at all', async ({ page }) => {
  await unlockBuilder(page);
  await page.route('**/api/ai-draft', route => route.fulfill({ json: { enabled: false } }));
  await page.goto('/free-wedding-planner');
  await expect(page.getByTestId('wedding-date')).toBeVisible();
  await expect(page.getByTestId('ai-draft-card')).toHaveCount(0);
});

test('arriving at #ai-draft through the email gate: the card is on screen and already knows the email', async ({ page }) => {
  await page.route('**/api/builder-signup', route => route.fulfill({ json: { ok: true } }));
  await page.route('**/api/ai-draft', route => route.fulfill({ json: { enabled: true, maxLength: 400 } }));
  await page.goto('/free-wedding-planner#ai-draft');
  await page.getByTestId('builder-email').fill('couple@example.com');
  await page.getByTestId('builder-consent').check();
  await page.getByTestId('builder-email-submit').click();
  await expect(page.getByTestId('ai-draft-card')).toBeInViewport();
  await expect(page.getByTestId('ai-email')).toHaveCount(0);
});
