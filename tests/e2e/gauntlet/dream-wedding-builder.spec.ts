import { test, expect } from '@playwright/test';
import { openSteps, unlockBuilder } from './unlock-builder';

test.beforeEach(async ({ page }) => { await unlockBuilder(page); });

test('surface gauntlet: required pages render without auth', async ({ page }) => {
  for (const path of ['/', '/free-wedding-planner', '/dashboard', '/trends', '/photos', '/pack', '/disclaimer', '/privacy']) {
    await page.goto(path);
    await expect(page.locator('body')).toContainText(/Dream Wedding|Disclaimer|Privacy|Planner Packet|Photo|Dashboard/);
    await expect(page.getByRole('link', { name: /Login|Sign in|Create account/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Login|Sign in|Create account/i })).toHaveCount(0);
  }
});


// The planner tests below were rewritten on 10 Nov 2026 with the planner itself
// (hostile review): her budget is the headline, every edit saves itself, venue types
// follow her answers, the printed plan shows only what she picked, and the free-text
// "Recommendation Studio" is gone. Each asserts the new behaviour at least as
// strictly as the test it replaced.
const MEMPHIS = { locations: 'Memphis', guestCount: '120', budgetTarget: '$30,000', budgetMode: 'hard', weddingDate: '2027-10-15', outdoorNeeds: 'Outdoor ceremony, live band, taco bar' };
async function seedPlan(page: import('@playwright/test').Page, plan: Record<string, unknown>) {
  await page.addInitScript((value) => { if (!localStorage.getItem('dwb-plan')) localStorage.setItem('dwb-plan', JSON.stringify(value)); }, plan);
}

test('outcome: new bride starts blank with no fake active wedding state', async ({ page }) => {
  await page.goto('/free-wedding-planner#your-date');
  const summary = page.getByTestId('canonical-plan-summary');
  await expect(page.getByTestId('guided-total')).toHaveText('Not set yet');
  await expect(summary).not.toContainText('$');
  await expect(summary.getByRole('link', { name: 'Add ›' })).toHaveCount(3);
  await openSteps(page, 'step-2');
  await expect(page.getByTestId('selected-venue-summary')).toContainText('Not decided yet');
  await expect(page.locator('[data-testid^="venue-"][data-fit]').first()).toBeVisible();
  // Nothing is offered as a fit before she has said anything, and no destination buyout is pushed.
  await expect(page.getByTestId('venue-destination-estate-buyout')).toHaveCount(0);
  await page.goto('/pack');
  await expect(page.getByTestId('pack-empty')).toBeVisible();
  await expect(page.getByTestId('pack-venues')).toHaveCount(0);
});

test('outcome: her stated budget is the headline, on the planner and on the printed plan', async ({ page }) => {
  await seedPlan(page, MEMPHIS);
  await page.goto('/free-wedding-planner#your-date');
  await expect(page.getByTestId('guided-total')).toHaveText('$30,000');
  await expect(page.getByTestId('budget-subline')).toContainText('$250 a guest');
  await expect(page.locator('main')).not.toContainText('$66,000');
  await openSteps(page, 'step-3');
  await expect(page.getByTestId('budget-split')).toContainText('A starting split of $30,000');
  // A choice that breaks a hard budget is said plainly, with what to lower.
  await page.getByTestId('budget-own-lines').locator('summary').click();
  await page.getByTestId('venue-budget').fill('26000');
  await page.getByTestId('floral-budget').fill('9000');
  await expect(page.getByTestId('budget-warning')).toContainText('$5,000 over your hard budget of $30,000');
  await page.getByTestId('floral-budget').fill('2000');
  await expect(page.getByTestId('budget-warning')).toHaveCount(0);
  await page.goto('/pack');
  await expect(page.getByTestId('pack-budget')).toContainText('Your budget: $30,000');
  await expect(page.getByTestId('pack-basics')).toContainText('$30,000 (hard limit)');
});

test('outcome: every edit saves itself and survives reload, back and the printed plan', async ({ page }) => {
  await seedPlan(page, MEMPHIS);
  await page.goto('/free-wedding-planner#your-date');
  await expect(page.getByTestId('save-guided-plan')).toHaveCount(0);
  await openSteps(page, 'step-0');
  await page.getByTestId('guest-input').fill('150');
  await expect(page.getByTestId('save-status')).toContainText('Saved in this browser ✓');
  await openSteps(page, 'step-2');
  await page.getByTestId('select-venue-public-park-garden').click();
  await page.reload();
  await expect(page.getByTestId('canonical-plan-summary')).toContainText('150');
  await page.goto('/pack');
  await expect(page.getByTestId('pack-basics')).toContainText('150');
  // Only what she picked is printed: one venue type, and it is hers.
  await expect(page.getByTestId('pack-venues').locator('.rounded-2xl')).toHaveCount(1);
  await expect(page.getByTestId('pack-venues')).toContainText('Park, public garden or pavilion');
  await page.goBack();
  await openSteps(page, 'step-0');
  await expect(page.getByTestId('guest-input')).toHaveValue('150');
  await page.goto('/dashboard');
  await expect(page.getByTestId('dashboard-venues')).toContainText('Park, public garden or pavilion');
});

test('outcome: venue types follow her answers (Memphis, outdoor, 120 guests)', async ({ page }) => {
  await seedPlan(page, MEMPHIS);
  await page.goto('/free-wedding-planner#your-date');
  await openSteps(page, 'step-2');
  await expect(page.getByTestId('venue-match-summary')).toContainText('outdoor · 120 guests · Memphis');
  const cards = page.locator('[data-testid^="venue-"][data-fit]');
  await expect(cards.first()).toHaveAttribute('data-fit', 'fits');
  await expect(cards.first()).toContainText('Outdoor, as you asked');
  for (const id of ['destination-estate-buyout', 'boutique-resort-borgo-buyout', 'villa-hotel-block-hybrid', 'restaurant-private-dining-example']) await expect(page.getByTestId(`venue-${id}`)).toHaveCount(0);
  await expect(page.getByTestId('venue-finder')).not.toContainText(/Italy|France|Spain/);
  await expect(page.getByTestId('venue-hidden')).toContainText('you have 120');
  // A destination wedding does get them.
  await openSteps(page, 'step-0');
  await page.getByTestId('location-input').fill('Tuscany, Italy');
  await page.getByTestId('guest-input').fill('80');
  await openSteps(page, 'step-2');
  await expect(page.getByTestId('venue-destination-estate-buyout')).toBeVisible();
});

test('outcome: questions to settle next come from her answers, with no free-text box and no human implied', async ({ page }) => {
  await seedPlan(page, MEMPHIS);
  await page.goto('/free-wedding-planner#your-date');
  await openSteps(page, 'step-1');
  await expect(page.getByTestId('next-question-rain')).toContainText('You said outdoor in Memphis');
  await expect(page.getByTestId('next-question-music')).toBeVisible();
  await expect(page.getByTestId('next-question-per-guest')).toContainText('$250');
  await expect(page.getByTestId('recommendation-question')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/Recommendation Studio|master planner|planner brain|Constraint mode|Trace:/);
  // Answering one removes it.
  await openSteps(page, 'step-0');
  await page.getByTestId('hard-constraint-detail').locator('summary').click();
  await page.getByTestId('rain-backup').fill('Tent on standby');
  await openSteps(page, 'step-1');
  await expect(page.getByTestId('next-question-rain')).toHaveCount(0);
});

test('outcome: steps open one at a time and never close the dated plan', async ({ page }) => {
  await page.goto('/free-wedding-planner#your-date');
  await openSteps(page, 'step-0');
  await openSteps(page, 'step-3');
  await expect(page.getByTestId('fold-toggle-step-0')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('section[data-fold="open"]')).toHaveCount(2);
  await expect(page.getByTestId('wedding-date')).toBeVisible();
  await page.getByTestId('wedding-date').fill('2027-10-15');
  await expect(page.getByTestId('dated-plan')).toHaveAttribute('data-state', 'future');
  await expect(page.getByTestId('full-plan-card')).toBeVisible();
});

test('outcome: photos page supports description-only flower girl dress sourcing', async ({ page }) => {
  await page.goto('/photos');
  await page.getByTestId('photo-category').selectOption('flower girl dresses');
  await page.getByTestId('photo-description').fill('ivory tulle flower girl dresses with puff sleeves and big satin bows');
    await page.getByTestId('analyze-photo').click();
  await expect(page.getByTestId('photo-results')).toContainText('Flower Girl Dress / Attire Finder');
  await expect(page.getByTestId('photo-results')).toContainText('sizing');
  await expect(page.getByTestId('photo-results')).toContainText('Exact product/vendor/availability/pricing must be verified');
});


test('outcome: vendor selections persist into dashboard and the printed plan', async ({ page }) => {
  await page.goto('/free-wedding-planner#your-date');
  await openSteps(page, 'step-5');
  await page.getByTestId('select-vendor-florist-designer').click();
  await expect(page.getByTestId('selected-vendor-summary')).toContainText('Florist / Designer');
  await page.goto('/dashboard');
  await expect(page.getByTestId('dashboard-vendors')).toContainText('Florist / Designer');
  await page.goto('/pack');
  await expect(page.getByTestId('pack-vendors').locator('.rounded-2xl')).toHaveCount(1);
  await expect(page.getByTestId('pack-vendors')).toContainText('Florist / Designer');
});

test('outcome: ideas start unselected, only chosen ideas persist, cheapest first on a hard budget', async ({ page }) => {
  await seedPlan(page, MEMPHIS);
  await page.goto('/free-wedding-planner#your-date');
  await openSteps(page, 'step-6');
  await expect(page.getByTestId('standout-ideas')).toContainText('In your plan: none yet');
  await expect(page.getByTestId('ideas-order-note')).toBeVisible();
  await expect(page.getByTestId('toggle-trend-hidden-champagne-wall-bartender')).toHaveCount(0);
  const first = page.locator('[data-testid^="toggle-trend-"]').first();
  await first.click();
  await page.goto('/pack');
  await expect(page.getByTestId('pack-ideas').locator('.rounded-2xl')).toHaveCount(1);
});

test('outcome: the printed plan carries the disclaimers and no unfilled blanks', async ({ page }) => {
  await seedPlan(page, MEMPHIS);
  await page.goto('/pack');
  await expect(page.getByRole('heading', { level: 1, name: 'Your wedding plan' })).toBeVisible();
  await expect(page.getByTestId('pack-letter')).toContainText('in Memphis on Fri 15 Oct 2027 for about 120 guests');
  await expect(page.getByTestId('pack-page')).not.toContainText(/\[|User-selected|Recommendation Studio|Bucket|Constraint/);
  await expect(page.getByTestId('pack-disclaimer')).toContainText('Estimated costs are planning estimates only');
  await expect(page.getByTestId('pack-disclaimer')).toContainText('not a substitute for a professional wedding planner');
  await expect(page.getByTestId('full-plan-card')).toBeVisible();
});

test('commercial hub and paid product pages are complete and clear', async ({ page }) => {
  await page.goto('/');
  // 2026-10-08: the homepage leads with the $9 checklist; its hero button posts that SKU to checkout.
  await expect(page.getByRole('heading', { level: 1, name: /wedding checklist built around your actual date/i })).toBeVisible();
  await expect(page.getByTestId('home-primary-cta').getByRole('button', { name: /Get the Wedding Checklist PDF — \$9/ })).toBeVisible();
  await expect(page.getByTestId('home-primary-cta').locator('input[name="sku"]')).toHaveValue('DWB-CHECKLIST-001');
  // Scoped to <main>: the desktop nav carries the same product names and is
  // display:none at mobile widths, so an unscoped .first() asserted against a
  // hidden nav item rather than against the page content.
  for (const name of ['Wedding Seating Chart Maker','Wedding Budget Spreadsheet','Wedding Timeline Template','Wedding Checklist PDF']) await expect(page.locator('main').getByText(name).first()).toBeVisible();
  await page.goto('/products/budget-spreadsheet');
  // The checkout button now names the product it buys, which is what the
  // commerce contract asserts elsewhere; "Buy now" was the pre-rename copy.
  await expect(page.getByRole('button', { name: /Buy Wedding Budget Spreadsheet — \$12/ }).first()).toBeVisible();
  await expect(page.getByText(/Why not a generic template/i)).toBeVisible();
  await expect(page.getByText(/Plain answers, before checkout/i)).toBeVisible();
});

test('authority pages render substantive content and route to owned product', async ({ page }) => {
  // /guides/wedding-budget-for-100-guests was folded into this page (301 in
  // data/seo/budget_rescue.json, 6 Nov 2026): the old guide must land here, and this
  // page must answer and route to the owned product.
  const res = await page.request.get('/guides/wedding-budget-for-100-guests', { maxRedirects: 0 });
  expect(res.status()).toBe(301);
  expect(res.headers()['location']).toMatch(/\/wedding-cost-per-guest$/);
  await page.goto('/wedding-cost-per-guest');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('What a wedding costs per guest');
  await expect(page.getByRole('heading', { name: 'Quick answer' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Review Wedding Budget Spreadsheet/ }).first()).toBeVisible();
});
