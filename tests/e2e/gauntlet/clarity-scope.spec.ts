import { test, expect, type Page } from '@playwright/test';

const sites = [
  ['weddingchecklistpdf.com', 'checklist-pdf', 'y7kxxtr48q'],
  ['weddingbudgetspreadsheet.com', 'budget-spreadsheet', 'y7kzpu45jb'],
  ['weddingseatingchartmaker.com', 'seating-chart-maker', 'y7kyy3fwc0'],
  ['weddingtimelinetemplate.com', 'timeline-template', 'y7l01t5b04']
] as const;

// Keep real hostnames in the browser (the loader selects a project by hostname),
// but serve this build locally. No test traffic is sent to a production site or
// to a real analytics project.
async function localSites(page: Page, baseURL: string) {
  await page.route('https://**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!sites.some(([host]) => host === url.hostname)) return route.abort();
    const response = await route.fetch({
      url: `${baseURL}${url.pathname}${url.search}`,
      headers: { ...route.request().headers(), host: url.hostname, 'x-forwarded-host': url.hostname },
      maxRedirects: 0
    });
    await route.fulfill({ response });
  });
}

const sdk = `window.recording = true; window.clarity = function(command) { window.recording = command === 'start'; };`;
const recording = (page: Page) => page.evaluate(() => (window as Window & { recording?: boolean }).recording);

test.afterEach(async ({ page }) => {
  // Let Next's in-flight prefetches finish before Playwright disposes the
  // request context backing route.fetch().
  await page.unrouteAll({ behavior: 'wait' });
});

for (const [host, slug, id] of sites) {
  test(`${host}: recording follows the form across client navigation`, async ({ page, baseURL }) => {
    await localSites(page, baseURL!);
    const tags: string[] = [];
    await page.route('https://www.clarity.ms/tag/*', async (route) => {
      tags.push(route.request().url());
      await route.fulfill({ contentType: 'application/javascript', body: sdk });
    });

    await page.goto(`https://${host}/guides`);
    await expect(page.locator('form')).toHaveCount(0);
    expect(tags).toEqual([]);
    expect(await recording(page)).toBeUndefined();

    await page.goto(`https://${host}/products/${slug}`);
    await expect.poll(() => recording(page)).toBe(true);
    expect(tags).toEqual([`https://www.clarity.ms/tag/${id}`]);
    // This value survives only if Next performs a client navigation.
    await page.evaluate(() => { (window as Window & { navigationProof?: string }).navigationProof = 'same-document'; });
    await page.locator('a[href="/guides"]').first().click();
    await expect(page).toHaveURL(`https://${host}/guides`);
    await expect(page.locator('form')).toHaveCount(0);
    await expect.poll(() => recording(page)).toBe(false);
    expect(await page.evaluate(() => (window as Window & { navigationProof?: string }).navigationProof)).toBe('same-document');

    await page.goBack();
    await expect(page).toHaveURL(`https://${host}/products/${slug}`);
    await expect.poll(() => recording(page)).toBe(true);
    expect(tags).toHaveLength(1);
  });
}

test('a delayed SDK response cannot keep recording after leaving the form', async ({ page, baseURL }) => {
  await localSites(page, baseURL!);
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => { release = resolve; });
  let requested = false;
  await page.route('https://www.clarity.ms/tag/*', async (route) => {
    requested = true;
    await waiting;
    await route.fulfill({ contentType: 'application/javascript', body: sdk });
  });
  await page.goto('https://weddingchecklistpdf.com/products/checklist-pdf', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => requested).toBe(true);
  await page.locator('a[href="/guides"]').first().click();
  await expect(page.locator('form')).toHaveCount(0);
  release();
  await expect.poll(() => recording(page)).toBe(false);
});
