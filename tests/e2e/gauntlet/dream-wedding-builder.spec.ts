import { test, expect } from '@playwright/test';

test('surface gauntlet: required pages render without auth', async ({ page }) => {
  for (const path of ['/', '/build', '/dashboard', '/trends', '/photos', '/pack', '/disclaimer', '/privacy', '/methodology']) {
    await page.goto(path);
    await expect(page.locator('body')).toContainText(/Dream Wedding|Disclaimer|Privacy|Pricing Methodology|Planner Packet|Photo/);
    await expect(page.getByText(/Login|Sign in|Create account/i)).toHaveCount(0);
  }
});

test('outcome: new bride starts blank with no fake active wedding state', async ({ page }) => {
  await page.goto('/build');
  const summary = page.getByTestId('canonical-plan-summary');
  await expect(summary).toContainText('Location not selected');
  await expect(summary).toContainText('Guest count unknown');
  await expect(summary).toContainText('Not estimated yet');
  await expect(summary).toContainText('Selected trends: 0');
  await expect(page.getByTestId('step-pack')).toContainText('Not selected yet');
  await expect(page.getByTestId('step-pack')).not.toContainText('Lake Como · 125 guests');
  await expect(page.getByTestId('step-pack')).not.toContainText('$118k');
});

test('outcome: bride wording and constraints become canonical plan state', async ({ page }) => {
  await page.goto('/build');
  await page.getByTestId('location-input').fill('Charleston, SC');
  await page.getByTestId('guest-input').fill('90');
  await page.getByTestId('budget-target').fill('65000');
  await page.getByTestId('own-vibe-input').fill('intimate candlelit garden dinner party, elegant but not stiff, not rustic');
  await page.getByText('garden romantic').click();
  await page.getByText('coastal venue').click();
  await expect(page.getByTestId('vibe-translator-output')).toContainText('Interpreted custom direction');
  await expect(page.getByTestId('vibe-translator-output')).toContainText(/planner|vendor/i);
  await page.getByTestId('save-guided-plan').click();

  await page.goto('/dashboard');
  const dashboard = page.getByTestId('dashboard-state');
  await expect(dashboard).toContainText('Charleston, SC');
  await expect(dashboard).toContainText('90 guests');
  await expect(dashboard).toContainText('Working Wedding Plan');
  await expect(dashboard).toContainText('candlelit garden dinner');

  await page.goto('/pack');
  await expect(page.locator('body')).toContainText('Charleston, SC');
  await expect(page.locator('body')).toContainText(/Guest count:\s*90|90 guests|approximately 90/);
  await expect(page.locator('body')).toContainText('candlelit garden dinner');
});

test('outcome: venue finder explains fit without fake live venue certainty', async ({ page }) => {
  await page.goto('/build');
  const venueFinder = page.getByTestId('venue-finder');
  await expect(venueFinder).toContainText(/Venue Finder|venue strategy/i);
  await expect(venueFinder).toContainText('not inventing live prices or availability');
  await expect(venueFinder).toContainText('Verify');
  await expect(venueFinder).toContainText('Confidence');
  await expect(venueFinder).toContainText(/Seeded venue-type|not a live venue quote|not live availability/);
  await expect(venueFinder).not.toContainText('live availability confirmed');
  await expect(venueFinder).not.toContainText('booked for your date');
  await expect(venueFinder).not.toContainText('we contacted the venue');
});

test('outcome: tablescape description becomes priced scope with vendors and warnings', async ({ page }) => {
  await page.goto('/build');
  const scopeSection = page.getByTestId('scope-intelligence');
  await expect(scopeSection).toContainText(/Photo\/Description-to-Scope Intelligence|Upload or describe anything/);
  await expect(scopeSection).toContainText('Exact pricing, vendor fit, product match, and availability require verification');
  await page.getByTestId('scope-category').selectOption('tablescape');
  await page.getByTestId('scope-description').fill('long tables with lace cloths, candles everywhere, soft pink flowers, bows on chairs, maybe chandeliers');
  await expect(page.getByTestId('analyze-photo')).toBeDisabled();
  await page.getByTestId('photo-consent').check();
  await page.getByTestId('analyze-photo').click();

  const results = page.getByTestId('photo-results');
  await expect(results).toContainText('Tablescape Decoder');
  await expect(results).toContainText(/Specialty linens|linens/i);
  await expect(results).toContainText(/Chandeliers|lighting|rigging/i);
  await expect(results).toContainText(/venue approval|venue rules|approval/i);
  await expect(results).toContainText(/Confidence|Verify|verification/i);
});

test('outcome: photo page supports description-only flower girl dress sourcing', async ({ page }) => {
  await page.goto('/photos');
  await page.getByTestId('photo-category').selectOption('flower girl dresses');
  await page.getByTestId('photo-description').fill('ivory tulle flower girl dresses with puff sleeves and big satin bows');
  await page.getByTestId('photo-consent').check();
  await page.getByTestId('analyze-photo').click();

  const results = page.getByTestId('photo-results');
  await expect(results).toContainText('Flower Girl Dress / Attire Finder');
  await expect(results).toContainText(/sizing|size chart|return policy|shipping/i);
  await expect(results).toContainText('Exact product/vendor/availability/pricing must be verified');
  await expect(results).not.toContainText('Bouquet + Floral Scope');
});

test('outcome: budget reality supports unknowns and pressure testing', async ({ page }) => {
  await page.goto('/build');
  await expect(page.getByTestId('budget-reality')).toContainText('Unknown');
  await page.getByTestId('guest-input').fill('200');
  await page.getByTestId('budget-target').fill('50000');
  await expect(page.getByTestId('budget-reality')).toContainText('High risk');
  await expect(page.getByTestId('budget-reality')).toContainText(/guest count|budget|realistic/i);
});

test('outcome: trends start unselected and only chosen trends persist', async ({ page }) => {
  await page.goto('/build');
  await expect(page.getByTestId('canonical-plan-summary')).toContainText('Selected trends: 0');
  await page.getByTestId('toggle-trend-gelato-cart').click();
  await page.getByTestId('save-guided-plan').click();
  await page.goto('/dashboard');
  await expect(page.getByText('Gelato Cart')).toBeVisible();
  await expect(page.getByText('Lake Como Color Smoke Kiss Moment')).toHaveCount(0);
});

test('outcome: trend library add flow writes selected trend without requiring account auth', async ({ page }) => {
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

test('outcome: printable packet contains planner-ready sections and caveats', async ({ page }) => {
  await page.goto('/build');
  await expect(page.getByTestId('step-pack')).toContainText('planner-ready working brief');

  await page.goto('/pack');
  await expect(page.getByText('Dream Wedding Working Brief')).toBeVisible();
  await expect(page.getByText('Venue Shortlist Strategy')).toBeVisible();
  await expect(page.getByText('Photo / Description Scope')).toBeVisible();
  await expect(page.getByText('Vendor Inquiry Questions')).toBeVisible();
  await expect(page.getByText('Estimated costs are planning estimates only')).toBeVisible();
  await expect(page.getByText('not a substitute for a professional wedding planner')).toBeVisible();
  await expect(page.locator('body')).toContainText(/No live venue availability|exact vendor pricing is claimed|must be directly verified/i);
});
