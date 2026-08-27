import { describe, expect, it } from 'vitest';
import { GET as sitemap } from '@/app/sitemap.xml/route';
import ledger from '@/data/seo/lastmod_ledger.json';
import registry from '@/data/authority/content_registry.json';
import { shippingPages } from '@/lib/authority-registry';
import { lastmodFor } from '@/lib/lastmod';
import { CANONICAL_HOSTS } from '@/lib/site-config';

const paths = ledger.paths as Record<string, { lastmod: string; source: string } | undefined>;

describe('lastmod reflects real content change', () => {
  // scripts/seo/build_lastmod_ledger.mjs is a Node build script and cannot import
  // isComplete() from TypeScript, so it keeps its own copy of the rule. This is the
  // guard that stops the copy from drifting away from lib/authority-registry.ts.
  it('agrees with lib/authority-registry about how many guides ship', () => {
    expect(ledger.shipping_guide_count).toBe(shippingPages.length);
  });

  it('has an entry for every registry page, including ones added by the last fan-out', () => {
    const missing = registry.pages.filter((page) => !paths[`/guides/${page.slug}`]).map((page) => page.slug);
    expect(missing).toEqual([]);
  });

  it('gives every published URL a lastmod', async () => {
    const missing: string[] = [];
    for (const host of CANONICAL_HOSTS) {
      const response = await sitemap(new Request(`https://${host}/sitemap.xml`, { headers: { host } }));
      const xml = await response.text();
      for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?/g)) {
        if (!match[2]) missing.push(match[1]);
      }
    }
    expect(missing).toEqual([]);
  });

  it('emits ISO dates, not timestamps or free text', () => {
    const malformed = Object.entries(paths).filter(([, entry]) => !/^\d{4}-\d{2}-\d{2}$/.test(entry?.lastmod ?? '')).map(([key]) => key);
    expect(malformed).toEqual([]);
  });

  // The defect this replaced was a single hardcoded constant on every URL. If the
  // ledger ever collapses back to one date across all four domains, it has stopped
  // measuring anything and is a fabricated freshness signal again.
  it('does not report one identical date for every URL', async () => {
    const dates = new Set<string>();
    for (const host of CANONICAL_HOSTS) {
      const response = await sitemap(new Request(`https://${host}/sitemap.xml`, { headers: { host } }));
      for (const match of (await response.text()).matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) dates.add(match[1]);
    }
    expect(dates.size).toBeGreaterThan(1);
  });

  it('never invents a date for a path it does not know', () => {
    expect(lastmodFor('/definitely-not-a-real-route')).toBeUndefined();
  });
});
