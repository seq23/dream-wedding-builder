import { test, expect } from '@playwright/test';
import { plannerLandings } from '../../../data/planner-landings';
import { plannerHref } from '../../../lib/planner-seed';

// The browser half of the seeding proof. The unit spec proves the arithmetic;
// this proves that a person who clicks a real link on a real page arrives at a
// planner that has actually changed.

test('every landing page opens the planner with its own constraint entered', async ({ page }) => {
  expect(plannerLandings.length, 'zero landing pages examined').toBeGreaterThan(0);

  for (const landing of plannerLandings) {
    // Start from the landing page itself, so the link under test is the one that
    // ships rather than a URL constructed by the test.
    await page.goto(`/${landing.slug}`);
    const link = page.getByTestId('landing-planner-link');
    await expect(link, `${landing.slug} has no planner link`).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href, `${landing.slug} planner link has no seed`).toContain('?');

    await page.evaluate(() => window.localStorage.clear());
    await link.click();
    await expect(page).toHaveURL(/\/free-wedding-planner\?/);

    const notice = page.getByTestId('seed-notice');
    await expect(notice, `${landing.slug} produced no seed notice`).toBeVisible();
    await expect(page.getByTestId('seed-applied')).toBeVisible();

    if (landing.seed.guests) {
      await expect(page.getByTestId('guest-input')).toHaveValue(landing.seed.guests);
    }
    if (landing.seed.mode) {
      await expect(page.getByTestId('canonical-plan-summary')).toContainText(landing.seed.mode);
    }
  }
});

test('a seed never overwrites a plan the reader already saved', async ({ page }) => {
  const landing = plannerLandings.find((item) => item.seed.guests);
  expect(landing, 'no landing page seeds a guest count, so this cannot be proved').toBeTruthy();

  // Build real saved work through the UI, not by writing storage directly.
  await page.goto('/free-wedding-planner');
  await page.evaluate(() => window.localStorage.clear());
  await page.goto('/free-wedding-planner');
  await page.getByTestId('constraint-mode-hard').click();
  await page.getByTestId('location-input').fill('Sonoma');
  await page.getByTestId('guest-input').fill('140');
  await page.getByTestId('save-guided-plan').click();

  // Now arrive through a seeded link that disagrees with the saved plan.
  await page.goto(plannerHref(landing!.seed));
  await expect(page.getByTestId('guest-input')).toHaveValue('140');
  await expect(page.getByTestId('location-input')).toHaveValue('Sonoma');
  await expect(page.getByTestId('seed-skipped')).toContainText('guest count');
});

test('a malformed seed silently no-ops and the planner still works', async ({ page }) => {
  await page.goto('/free-wedding-planner');
  await page.evaluate(() => window.localStorage.clear());
  await page.goto('/free-wedding-planner?guests=abc&focus=nonsense&venue=hogwarts&%%%');
  await expect(page.getByTestId('canonical-plan-summary')).toContainText('Guest count unknown');
  await expect(page.getByTestId('seed-notice')).toHaveCount(0);
  // The planner is still fully usable, which is the whole point of failing quietly.
  await page.getByTestId('constraint-mode-hard').click();
  await expect(page.getByTestId('constraint-fields')).toBeVisible();
});

test('every guide hands off to the planner with its own seed', async ({ page }) => {
  await page.goto('/guides');
  const first = page.locator('a[href^="/guides/"]').first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page.getByTestId('guide-planner-entry')).toBeVisible();
  const href = await page.getByTestId('guide-planner-link').getAttribute('href');
  expect(href).toContain('/free-wedding-planner?');
  await page.evaluate(() => window.localStorage.clear());
  await page.getByTestId('guide-planner-link').click();
  await expect(page.getByTestId('seed-notice')).toBeVisible();
});

test('the old /build URL redirects permanently and keeps its query string', async ({ page }) => {
  // Six days of indexing is not much, but a rename with a broken redirect is how
  // a route quietly stops existing. The seed must survive the hop too, or every
  // link published before the rename becomes an unseeded one.
  const response = await page.goto('/build?guests=80');
  expect(response?.status()).toBe(200);
  expect(page.url()).toContain('/free-wedding-planner');
  expect(page.url()).toContain('guests=80');
  await expect(page.getByTestId('seed-notice')).toBeVisible();
});

test('the methodology worked example is the shipped planner output, not prose about it', async ({ page }) => {
  // Computed here from the same function the page calls. If /methodology ever
  // starts describing Step 3 rather than running it, these two stop matching.
  const { budgetReality, emptyPlan } = await import('../../../data/planning');
  const expected = budgetReality({
    ...emptyPlan,
    constraintMode: 'hard',
    guestCount: '80',
    budgetTarget: '18000',
    budgetMode: 'hard',
    priorities: ['Food + Bar', 'Photography', 'Guest Comfort']
  });

  await page.goto('/methodology');
  await expect(page.getByTestId('methodology-contrast')).toBeVisible();
  await expect(page.getByTestId('methodology-contrast')).toContainText('Calculators tell you what a wedding costs. This tells you what to change.');
  await expect(page.getByTestId('methodology-worked-example')).toHaveText(expected);

  // The claim stays narrower than the headline: no affordability verdict.
  await expect(page.getByTestId('methodology-contrast')).toContainText('It orders the cuts.');

  // And the contrast reaches the structured data, which is what gets quoted.
  // The page emits several blocks (breadcrumb, DefinedTerm, HowTo); the contrast
  // must be in the DefinedTerm description specifically.
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const definedTerm = blocks.map((block) => JSON.parse(block)).flat().find((node) => node['@type'] === 'DefinedTerm');
  expect(definedTerm, 'no DefinedTerm in the structured data').toBeTruthy();
  expect(definedTerm.description).toContain('Calculators tell you what a wedding costs. This tells you what to change.');
});
