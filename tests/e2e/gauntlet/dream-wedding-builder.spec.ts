import { test, expect } from '@playwright/test';

test('surface gauntlet: required pages render without auth', async ({ page }) => {
  for (const path of ['/', '/build', '/dashboard', '/trends', '/photos', '/pack', '/disclaimer', '/privacy']) {
    await page.goto(path);
    await expect(page.locator('body')).toContainText(/Dream Wedding|Disclaimer|Privacy|Planner Packet|Photo|Dashboard/);
    await expect(page.getByRole('link', { name: /Login|Sign in|Create account/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Login|Sign in|Create account/i })).toHaveCount(0);
  }
});

test('outcome: new bride starts blank with no fake active wedding state', async ({ page }) => {
  await page.goto('/build');
  await expect(page.getByTestId('canonical-plan-summary')).toContainText('Location not selected');
  await expect(page.getByTestId('canonical-plan-summary')).toContainText('Guest count unknown');
  await expect(page.getByTestId('canonical-plan-summary')).toContainText('Not estimated yet');
  await expect(page.getByTestId('canonical-plan-summary')).toContainText('Selected venues: 0');
  await expect(page.getByTestId('selected-venue-summary')).toContainText('None selected yet');
  await expect(page.getByTestId('step-pack')).not.toContainText('Lake Como · 125 guests');
});

test('outcome: hard constraints reveal planner-grade constraint profile fields', async ({ page }) => {
  await page.goto('/build');
  await page.getByTestId('constraint-mode-hard').click();
  await expect(page.getByTestId('constraint-fields')).toBeVisible();
  await page.getByTestId('location-input').fill('Italy');
  await page.getByTestId('guest-input').fill('80');
  await page.getByTestId('full-buyout').selectOption('required');
  await page.getByTestId('onsite-sleep-count').fill('70-80 guests');
  await page.getByTestId('outside-catering').selectOption('required');
  await page.getByTestId('fixed-items').fill('Italy, full venue buyout, sleeps 70-80 guests, outside food catering allowed');
  await expect(page.getByTestId('studio-constraint-summary')).toContainText('Italy');
  await expect(page.getByTestId('venue-match-summary')).toContainText('Full buyout');
  await expect(page.getByTestId('venue-match-summary')).toContainText('outside catering');
});

test('outcome: Recommendation Studio uses Italy buyout constraints and persists to dashboard and packet', async ({ page }) => {
  await page.goto('/build');
  await page.getByTestId('constraint-mode-hard').click();
  await page.getByTestId('location-input').fill('Italy');
  await page.getByTestId('guest-input').fill('80');
  await page.getByTestId('full-buyout').selectOption('required');
  await page.getByTestId('onsite-sleep-count').fill('70-80 guests');
  await page.getByTestId('outside-catering').selectOption('required');
  await page.getByTestId('recommendation-focus').selectOption('Venue + Lodging');
  await page.getByTestId('recommendation-question').fill('Italy, full venue buyout required, sleeps 70-80 guests, outside catering allowed. What kind of venue should I search for?');
  await page.getByTestId('run-recommendation').click();
  await expect(page.getByTestId('recommendation-output')).toContainText('venue-and-hospitality search');
  await expect(page.getByTestId('recommendation-output')).toContainText('Private villa / estate buyout');
  await expect(page.getByTestId('recommendation-output')).toContainText('Full buyout + sleeps 70');
  await page.getByTestId('save-guided-plan').click();
  await page.goto('/dashboard');
  await expect(page.getByTestId('dashboard-recommendation')).toContainText('venue-and-hospitality search');
  await page.goto('/pack');
  await expect(page.locator('body')).toContainText('Recommendation Studio');
  await expect(page.locator('body')).toContainText('Private villa / estate buyout');
});

test('outcome: Recommendation Studio gives context-aware floral guidance', async ({ page }) => {
  await page.goto('/build');
  await page.getByTestId('constraint-mode-flexible').click();
  await page.getByTestId('location-input').fill('Georgia outdoor garden estate');
  await page.getByTestId('guest-input').fill('120');
  await page.getByTestId('colors-loved').fill('pink, orange, yellow');
  await page.getByTestId('priority-florals').click();
  await page.getByTestId('recommendation-focus').selectOption('Florals / Decor / Rentals');
  await page.getByTestId('recommendation-question').fill('I want pink and orange and yellow flowers. What cute flowers can go together in all the bouquets?');
  await page.getByTestId('run-recommendation').click();
  await expect(page.getByTestId('recommendation-output')).toContainText('Southern Citrus Garden');
  await expect(page.getByTestId('recommendation-output')).toContainText('Georgia');
  await expect(page.getByTestId('recommendation-output')).toContainText('Florals are protected');
});

test('outcome: venue selections persist into dashboard and packet', async ({ page }) => {
  await page.goto('/build');
  await page.getByTestId('constraint-mode-hard').click();
  await page.getByTestId('location-input').fill('Italy');
  await page.getByTestId('guest-input').fill('80');
  await page.getByTestId('select-venue-destination-estate-buyout').click();
  await expect(page.getByTestId('selected-venue-summary')).toContainText('Private villa / estate buyout');
  await page.getByTestId('save-guided-plan').click();
  await page.goto('/dashboard');
  await expect(page.getByTestId('dashboard-venues')).toContainText('Private villa / estate buyout');
  await page.goto('/pack');
  await expect(page.locator('body')).toContainText('User-selected venue strategies are carried forward');
  await expect(page.locator('body')).toContainText('Private villa / estate buyout');
});

test('outcome: budget reality syncs Step 0 guest count and protects non-negotiables', async ({ page }) => {
  await page.goto('/build');
  await page.getByTestId('constraint-mode-flexible').click();
  await expect(page.getByTestId('budget-reality')).toContainText('Unknown');
  await page.getByTestId('guest-input').fill('90');
  await expect(page.getByTestId('budget-guest-sync')).toContainText('90');
  await page.getByTestId('budget-target').fill('65000');
  await page.getByTestId('priority-venue-privacy').click();
  await page.getByTestId('priority-food-bar').click();
  await page.getByTestId('priority-photography').click();
  await expect(page.getByTestId('budget-reality')).toContainText('Guest count 90');
  await expect(page.getByTestId('budget-reality')).toContainText('Protect what matters');
  await expect(page.getByTestId('protected-priorities')).toContainText('Venue privacy');
});

test('outcome: no-constraints discovery route still makes Recommendation Studio usable', async ({ page }) => {
  await page.goto('/build');
  await page.getByTestId('constraint-mode-discovery').click();
  await expect(page.getByTestId('fixed-flexible-unknown')).toBeVisible();
  await page.getByTestId('recommendation-focus').selectOption('I am overwhelmed');
  await page.getByTestId('recommendation-question').fill('I have no idea where to start. Tell me what constraints matter first.');
  await page.getByTestId('run-recommendation').click();
  await expect(page.getByTestId('recommendation-output')).toContainText('saved constraint profile');
  await expect(page.getByTestId('recommendation-output')).toContainText('fixed/flexible/unknown');
});

test('outcome: build page points users to Photos Lab and saves scope result', async ({ page }) => {
  await page.goto('/build');
  await expect(page.getByTestId('photos-cta-tablescape')).toBeVisible();
  await expect(page.getByTestId('photos-cta-attire')).toBeVisible();
  await expect(page.getByTestId('photos-cta-anything')).toBeVisible();
  await expect(page.getByTestId('scope-to-studio-cta')).toBeVisible();
  await page.getByTestId('constraint-mode-flexible').click();
  await page.getByTestId('guest-input').fill('88');
  await page.getByTestId('scope-category').selectOption('tablescape');
  await page.getByTestId('scope-description').fill('long tables with lace cloths, candles everywhere, soft pink flowers, bows on chairs, maybe chandeliers');
  await expect(page.getByTestId('analyze-photo')).toBeDisabled();
  await page.getByTestId('photo-consent').check();
  await page.getByTestId('analyze-photo').click();
  await expect(page.getByTestId('photo-results')).toContainText('Tablescape Decoder');
  await expect(page.getByTestId('photo-results')).toContainText('Specialty linens');
  await page.getByTestId('save-guided-plan').click();
  await page.goto('/dashboard');
  await expect(page.getByTestId('dashboard-scope')).toContainText('Tablescape Decoder');
  await page.goto('/pack');
  await expect(page.locator('body')).toContainText('Tablescape Decoder');
});

test('outcome: photos page supports description-only flower girl dress sourcing', async ({ page }) => {
  await page.goto('/photos');
  await page.getByTestId('photo-category').selectOption('flower girl dresses');
  await page.getByTestId('photo-description').fill('ivory tulle flower girl dresses with puff sleeves and big satin bows');
  await page.getByTestId('photo-consent').check();
  await page.getByTestId('analyze-photo').click();
  await expect(page.getByTestId('photo-results')).toContainText('Flower Girl Dress / Attire Finder');
  await expect(page.getByTestId('photo-results')).toContainText('sizing');
  await expect(page.getByTestId('photo-results')).toContainText('Exact product/vendor/availability/pricing must be verified');
});

test('outcome: vendor selections persist into dashboard and packet', async ({ page }) => {
  await page.goto('/build');
  await page.getByTestId('select-vendor-florist-designer').click();
  await expect(page.getByTestId('selected-vendor-summary')).toContainText('Florist / Designer');
  await page.getByTestId('save-guided-plan').click();
  await page.goto('/dashboard');
  await expect(page.getByTestId('dashboard-vendors')).toContainText('Florist / Designer');
  await page.goto('/pack');
  await expect(page.locator('body')).toContainText('User-selected vendor focus areas are listed first');
  await expect(page.locator('body')).toContainText('Florist / Designer');
});

test('outcome: trends start unselected and only chosen trends persist', async ({ page }) => {
  await page.goto('/build');
  await expect(page.getByTestId('canonical-plan-summary')).toContainText('Selected standout ideas: 0');
  await page.getByTestId('toggle-trend-color-smoke-kiss-moment').click();
  await page.getByTestId('save-guided-plan').click();
  await page.goto('/dashboard');
  await expect(page.getByText('Color Smoke Kiss Moment')).toBeVisible();
  await expect(page.getByText('Lake Como Color Smoke Kiss Moment')).toHaveCount(0);
});

test('outcome: printable packet contains planner-grade sections and caveats', async ({ page }) => {
  await page.goto('/build');
  await page.getByTestId('constraint-mode-hard').click();
  await page.getByTestId('location-input').fill('Italy');
  await page.getByTestId('guest-input').fill('80');
  await page.getByTestId('budget-target').fill('150000');
  await page.getByTestId('select-venue-destination-estate-buyout').click();
  await page.getByTestId('select-vendor-planner-coordinator').click();
  await page.getByTestId('save-guided-plan').click();
  await page.goto('/pack');
  await expect(page.getByText('Dream Wedding Working Brief')).toBeVisible();
  await expect(page.getByText('Planning Reality Check / Constraint Profile')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recommendation Studio' })).toBeVisible();
  await expect(page.getByText('Venue + Lodging Shortlist Strategy')).toBeVisible();
  await expect(page.getByText('Vendor Focus + Inquiry Questions')).toBeVisible();
  await expect(page.getByText('Full Planner Bucket Map')).toBeVisible();
  await expect(page.locator('body')).toContainText('Estimated costs are planning estimates only');
  await expect(page.locator('body')).toContainText('not a substitute for a professional wedding planner');
  await expect(page.locator('body')).toContainText(/No live venue availability|must be directly verified/i);
});
