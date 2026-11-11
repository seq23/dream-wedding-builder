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
  // Without the tick nothing is sent, and the card says why (a disabled button said nothing).
  await page.getByTestId('ai-submit').click();
  await expect(page.getByTestId('ai-message')).toContainText('Tick the box first');
  await page.getByTestId('ai-consent').check();
  await page.getByTestId('ai-submit').click();
  // The result shows the values themselves, and her own guest count was kept.
  await expect(page.getByTestId('ai-result')).toContainText('Memphis, TN');
  await expect(page.getByTestId('ai-result')).toContainText('Your own answers were kept');
  await expect(page.getByTestId('ai-result')).not.toContainText('200');
  await expect(page.getByTestId('ai-drafted-label')).toContainText('AI-drafted');
  await expect(page.getByTestId('dated-plan')).toHaveAttribute('data-state', 'future');
  // Used: no second run is possible, and the card says the server's own sentence.
  await expect(page.getByTestId('ai-submit')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('ai-submit')).toHaveCount(0);
  await expect(page.getByTestId('ai-used-message')).toContainText('You have used your free AI draft for this email');
  await expect(page.getByTestId('ai-drafted-label')).toContainText('Memphis in June is hot');
  await page.goto('/pack');
  await expect(page.getByTestId('ai-drafted-label')).toBeVisible();
});

test('a busy model shows a calm try-again and leaves the plan as it was', async ({ page }) => {
  await unlockBuilder(page);
  await page.addInitScript(() => localStorage.setItem('dwb-builder-email', 'a@example.com'));
  await page.route('**/api/ai-draft', route => route.request().method() === 'GET'
    ? route.fulfill({ json: { enabled: true, maxLength: 400 } })
    : new Promise(r => setTimeout(r, 1200)).then(() => route.fulfill({ status: 503, json: { ok: false, code: 'BUSY', error: 'AI drafting is busy. Please try again later; you can still build your plan by hand below.' } })));
  await page.goto('/free-wedding-planner');
  await page.getByTestId('ai-description').fill('200 guests, June in Memphis, small budget');
  await page.getByTestId('ai-consent').check();
  await page.getByTestId('ai-submit').click();
  // While it waits there is a visible progress state, not just a paler button.
  await expect(page.getByTestId('ai-progress')).toContainText('Reading your sentence');
  await expect(page.getByTestId('ai-message')).toContainText('try again later');
  await expect(page.getByTestId('ai-submit')).toBeVisible();
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

test('a new visitor gives her email in the AI card itself: stored first (marketing off unless ticked), then drafted', async ({ page }) => {
  const calls: string[] = []; let signup: Record<string, unknown> | null = null;
  await page.route('**/api/builder-signup', route => { calls.push('signup'); signup = route.request().postDataJSON(); return route.fulfill({ json: { ok: true } }); });
  await page.route('**/api/ai-draft', route => { if (route.request().method() === 'GET') return route.fulfill({ json: { enabled: true, maxLength: 400 } }); calls.push('draft'); return route.fulfill({ json: { ok: true, draft: { ...draft, weddingDate: '2027-10-15' }, remaining: 0 } }); });
  await page.goto('/free-wedding-planner#ai-draft');
  await expect(page.getByTestId('ai-draft-card')).toBeInViewport();
  await page.getByTestId('ai-description').fill('200 guests, June in Memphis, small budget');
  await page.getByTestId('ai-consent').check();
  await page.getByTestId('ai-submit').click();
  await expect(page.getByTestId('ai-message')).toContainText('Enter your email');
  expect(calls).toEqual([]);
  await page.getByTestId('ai-email').fill('couple@example.com');
  await page.getByTestId('ai-submit').click();
  await expect(page.getByTestId('ai-result')).toBeVisible();
  expect(calls).toEqual(['signup', 'draft']);
  expect(signup).toMatchObject({ email: 'couple@example.com', marketing: false });
});
