import { expect, test } from '@playwright/test';
import path from 'node:path';
import { writeFileSync, mkdtempSync } from 'node:fs';
import os from 'node:os';

// The free journey, steps 1 and 2, at 390 px with the server mocked: the limits and
// checks are proved in tests/unit/wedding-read.test.ts; this proves what she sees.
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const read = (by: 'ai' | 'fixed', venueTypes = [{ id: 'public-park-garden', name: 'Park, public garden or pavilion', why: 'Wide lawns.' }]) => ({
  by, headline: 'A relaxed garden wedding, outdoors in Memphis in the fall, for 100.', read: 'You can lean on greenery and long tables.',
  directions: [{ name: 'Garden layers', what: 'Potted greenery.' }, { name: 'Warm light', what: 'String lights.' }],
  colours: [{ name: 'Amber', hex: '#d9822b' }, { name: 'Olive', hex: '#556b2f' }, { name: 'Cream', hex: '#fdfbf7' }],
  venueTypes, ideas: [{ id: 'dinner-party-layout', name: 'Dinner-Party Reception Layout', cost: 'Medium cost', why: 'Easy and talkative.' }],
  details: ['Pillar candles in clear glass down every table'], ask: ['Ask the caterer how food stays warm outdoors.'], honest: '', photoNotes: []
});

// A real JPEG-shaped file is not needed to prove the flow: a 2x2 PNG is read for colours like any photo.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');

test('step 1 asks nothing until she chooses, needs no email, and shows her wedding on step 2', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  let posted: Record<string, unknown> | null = null;
  await page.route('**/api/wedding-read', async route => { posted = route.request().postDataJSON(); await route.fulfill({ json: { ok: true, read: read('ai'), remaining: 2, limit: 3, reason: 'ai' } }); });
  await page.goto('/free-wedding-planner');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What should your wedding feel like?');
  await expect(page.getByTestId('journey-continue')).toBeDisabled();
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
  await page.getByTestId('fork-dk').click();
  await page.getByTestId('season-Fall').click();
  await page.getByTestId('setting-Outdoors').click();
  await page.getByTestId('mood-Relaxed').click();
  await page.getByTestId('mood-Garden').click();
  const dir = mkdtempSync(path.join(os.tmpdir(), 'dw-'));
  writeFileSync(path.join(dir, 'p.png'), png);
  await page.getByTestId('journey-photo-input').setInputFiles(path.join(dir, 'p.png'));
  await expect(page.getByTestId('journey-photo')).toHaveCount(1);
  await expect(page.getByTestId('photo-allow-ai')).not.toBeChecked();
  await page.getByTestId('journey-continue').click();
  await expect(page.getByTestId('journey-step-2')).toBeVisible();
  // Nothing from the photo left the phone without the tick; its colours did not need it.
  expect(posted).toMatchObject({ path: 'dk', season: 'Fall', setting: 'Outdoors', moods: ['Relaxed', 'Garden'] });
  expect(JSON.stringify(posted)).not.toContain('"image"');
  await expect(page.getByTestId('read-label')).toContainText('Written by an AI planner, not a person');
  await expect(page.getByTestId('read-venues')).toBeVisible();
  // No place given: no "near you".
  await expect(page.getByTestId('read-venues')).toContainText('Kinds of place that carry this feel');
  await expect(page.getByTestId('journey-change')).toContainText('2 of 3 left today');
  expect(errors).toEqual([]);
});

test('a ticked photo is shrunk and sent; a booked venue shows no venue types; past the limit she still gets an answer', async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  await page.route('**/api/wedding-read', async route => { bodies.push(route.request().postDataJSON()); await route.fulfill({ json: { ok: true, read: read('fixed', []), remaining: 0, limit: 3, reason: 'visitor_limit' } }); });
  await page.goto('/free-wedding-planner');
  await page.getByTestId('fork-idea').click();
  await page.getByTestId('journey-wish').fill('Candlelit long tables, jazz, 60 people');
  const dir = mkdtempSync(path.join(os.tmpdir(), 'dw-'));
  writeFileSync(path.join(dir, 'p.png'), png);
  await page.getByTestId('journey-photo-input').setInputFiles(path.join(dir, 'p.png'));
  await page.getByTestId('photo-allow-ai').check();
  await page.getByTestId('journey-facts').locator('summary').click();
  await page.getByTestId('fact-venue-booked').check();
  await page.getByTestId('journey-continue').click();
  await expect(page.getByTestId('journey-step-2')).toHaveAttribute('data-by', 'fixed');
  const photos = bodies[0].photos as { image?: string }[];
  expect(photos[0].image?.length).toBeGreaterThan(20);
  await expect(page.getByTestId('read-venue-booked')).toBeVisible();
  await expect(page.getByTestId('read-venues')).toHaveCount(0);
  await expect(page.getByTestId('read-label')).toContainText('three AI answers');
  await expect(page.getByTestId('journey-change')).toContainText('0 of 3 left today');
});

test('a new bride sees nothing under the journey; "I already know what I want" opens the dated plan, and it stays open when she comes back', async ({ page }) => {
  await page.goto('/free-wedding-planner');
  await expect(page.getByTestId('journey-step-1')).toBeVisible();
  await expect(page.getByTestId('wedding-date')).toHaveCount(0);
  await expect(page.getByTestId('canonical-plan-summary')).toHaveCount(0);
  await page.getByTestId('journey-skip').click();
  await expect(page.getByTestId('wedding-date')).toBeInViewport();
  await page.reload();
  await expect(page.getByTestId('wedding-date')).toHaveCount(1);
});

test('a bride who reaches step 4 gets her plan below the journey, and only then', async ({ page }) => {
  await page.route('**/api/journey-reach', route => route.fulfill({ json: { ok: true } }));
  await page.route('**/api/wedding-read', route => route.fulfill({ json: { ok: true, read: read('fixed', []), remaining: 2, limit: 3, reason: 'no_model' } }));
  await page.goto('/free-wedding-planner');
  await page.getByTestId('fork-dk').click();
  await page.getByTestId('journey-continue').click();
  await page.getByTestId('journey-continue-2').click();
  await page.getByTestId('journey-continue-3').click();
  await expect(page.getByTestId('wedding-date')).toHaveCount(0);
  await page.getByTestId('journey-no-date').click();
  await expect(page.getByTestId('wedding-date')).toHaveCount(1);
});

test('kept picks become dated tasks marked "Your pick", a booked venue drops the venue task, and the printable page carries them', async ({ page }) => {
  let reached = 0;
  await page.route('**/api/journey-reach', route => { reached++; return route.fulfill({ json: { ok: true } }); });
  await page.route('**/api/wedding-read', route => route.fulfill({ json: { ok: true, read: read('ai', []), remaining: 2, limit: 3, reason: 'ai' } }));
  await page.route('**/api/builder-signup', route => route.fulfill({ json: { ok: true } }));
  await page.goto('/free-wedding-planner');
  await page.getByTestId('fork-dk').click();
  await page.getByTestId('journey-facts').locator('summary').click();
  await page.getByTestId('fact-venue-booked').check();
  await page.getByTestId('journey-continue').click();
  await page.getByTestId('journey-continue-2').click();
  await expect(page.getByTestId('journey-step-3')).toBeVisible();
  await expect(page.getByText('The kind of place')).toHaveCount(0);
  await page.getByTestId('journey-pick').filter({ hasText: 'Dinner-Party Reception Layout' }).click();
  await page.getByTestId('journey-pick').filter({ hasText: 'Pillar candles' }).click();
  await page.getByTestId('journey-continue-3').click();
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
  const d = new Date(); d.setMonth(d.getMonth() + 14);
  await page.getByTestId('journey-date').fill(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`);
  await expect(page.getByTestId('journey-dated')).toContainText('2 of your picks');
  expect(reached).toBe(1);
  await page.getByTestId('journey-to-plan').click();
  await expect(page.getByTestId('dated-task-pick')).toHaveCount(2);
  await expect(page.getByTestId('dated-plan')).not.toContainText('Book the venue (it decides');
  await page.getByTestId('journey-printable').click();
  await page.getByTestId('builder-email').fill('couple@example.com');
  await page.getByTestId('builder-email-submit').click();
  await expect(page.getByTestId('pack-page')).toContainText('Plan this idea with the vendor it needs: Dinner-Party Reception Layout');
});
