// Guard: every canonical host's homepage emits the same JSON-LD type set.
// Origin (2026-10-11): weddingchecklistpdf.com renders its own `/` (app/page.tsx,
// root_action "render") and shipped no JSON-LD at all, while the three hosts whose
// `/` redirects to a HubPage carried Article/FAQPage/BreadcrumbList (+HowTo on two).
// Both templates now call lib/site-home.ts homeSchemaNodes(); this renders both.
import { describe, expect, it } from 'vitest';
import { HOMEPAGE_SCHEMA_TYPES } from '@/lib/site-home';
import { HOSTS, jsonLdNodes, renderHome, renderHub, typeSet } from './helpers/site-homes';

describe('homepage JSON-LD parity across the four sites', () => {
  it('covers all four hosts', () => { expect(HOSTS.length).toBe(4); });
  const expected = [...HOMEPAGE_SCHEMA_TYPES].sort();
  for (const host of HOSTS) {
    it(`${host} homepage emits exactly the shared homepage type set`, () => {
      const html = renderHome(host);
      expect(typeSet(html)).toEqual(expected);
      const nodes = jsonLdNodes(html);
      expect(nodes.filter((n) => n['@type'] === 'BreadcrumbList')).toHaveLength(1);
      const site = nodes.find((n) => n['@type'] === 'WebSite')!;
      expect(site.url).toBe(`https://${host}/`);
      const faq = nodes.find((n) => n['@type'] === 'FAQPage') as { mainEntity: unknown[] };
      expect(faq.mainEntity.length).toBeGreaterThan(0);
      const howTo = nodes.find((n) => n['@type'] === 'HowTo') as { step: unknown[] };
      expect(howTo.step.length).toBeGreaterThan(0);
    });
  }
  it('all four homepages emit an identical type set', () => {
    const sets = HOSTS.map((h) => typeSet(renderHome(h)).join(','));
    expect(new Set(sets).size).toBe(1);
  });
  it('a non-home hub keeps the hub node set (home nodes do not leak onto every hub)', () => {
    const types = typeSet(renderHub('wedding-checklist'));
    expect(types).not.toContain('WebSite');
    expect(types).toContain('Article');
  });
});
