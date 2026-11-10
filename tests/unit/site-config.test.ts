import pageRescue from '@/data/seo/page_rescue.json';
import rescue from '@/data/seo/budget_rescue.json';
import { describe, expect, it } from 'vitest';
import { aliasRedirectTarget, apexHost, CANONICAL_HOSTS, canonicalHostForPath, guidesForHost, hostConfig, isCanonicalHost } from '@/lib/site-config';

describe('canonical host ownership', () => {
  it('normalizes www hosts to apex', () => expect(apexHost('www.weddingchecklistpdf.com:443')).toBe('weddingchecklistpdf.com'));
  it('owns the checklist trunk on the parent host', () => expect(canonicalHostForPath('/wedding-checklist')).toBe('weddingchecklistpdf.com'));
  it('owns the budget hub on the budget host', () => expect(canonicalHostForPath('/wedding-budget-spreadsheet')).toBe('weddingbudgetspreadsheet.com'));
  it('owns the broad wedding-day timeline guide on the main site, not the timeline host', () => expect(canonicalHostForPath('/guides/wedding-day-timeline')).toBe('weddingchecklistpdf.com'));
  it('defines satellite root redirects', () => expect(hostConfig['weddingseatingchartmaker.com'].root_target).toBe('/wedding-seating-chart'));
  it('keeps the exact consolidated budget inventory and the other hosts complete', () => {
    for (const host of CANONICAL_HOSTS) {
      if (host === rescue.host) expect(guidesForHost(host).map((page) => page.slug).sort()).toEqual([...rescue.kept_guides].sort());
      else { const expected = pageRescue.kept_paths_by_host[host].filter(path => path.startsWith('/guides/')).map(path => path.slice('/guides/'.length)); expect(expected.length).toBeGreaterThan(0); expect(guidesForHost(host).map(page => page.slug).sort()).toEqual(expected.sort()); }
    }
  });
});

// The domain printed inside five published Kindle EPUBs. It answers, and it must
// never publish: if it were ever treated as canonical the site would gain a
// second indexable copy of every page, and if the redirect stopped preserving
// the path every reader arriving from a book would land on the wrong page.
describe('book alias host', () => {
  const BOOK_ALIAS = 'weddingpdfchecklist.com';
  it('redirects the apex to the canonical host', () => expect(aliasRedirectTarget(BOOK_ALIAS)).toBe('weddingchecklistpdf.com'));
  it('redirects the www form to the same place', () => expect(aliasRedirectTarget(`www.${BOOK_ALIAS}`)).toBe('weddingchecklistpdf.com'));
  it('tolerates a port on the host header', () => expect(aliasRedirectTarget(`${BOOK_ALIAS}:443`)).toBe('weddingchecklistpdf.com'));
  it('is never a canonical host', () => expect(isCanonicalHost(BOOK_ALIAS)).toBe(false));
  it('leaves canonical hosts alone', () => expect(aliasRedirectTarget('weddingchecklistpdf.com')).toBeNull());
  it('leaves unknown hosts alone', () => expect(aliasRedirectTarget('example.com')).toBeNull());
});

// Guard for 7 Nov 2026 (weddingbudgetspreadsheet.com impressions 60 -> 6): the
// satellites' own guides were in no guide index anywhere, because a satellite's
// /guides 301s to the main site and the main index listed main-site guides only.
describe('the main guide index links every satellite guide at the host that serves it', () => {
  it('lists each satellite guide, owned by and canonical on its satellite', async () => {
    const { satelliteGuides, PARENT_HOST } = await import('@/lib/site-config');
    const guides = satelliteGuides();
    expect(guides.length).toBeGreaterThan(0);
    for (const { host, page, url } of guides) {
      expect(host).not.toBe(PARENT_HOST);
      expect(canonicalHostForPath(`/guides/${page.slug}`)).toBe(host);
      expect(url).toBe(`https://${host}/guides/${page.slug}`);
    }
  });

  it('renders those links on /guides, and the main-site list alone would miss them', async () => {
    const { satelliteGuides, PARENT_HOST } = await import('@/lib/site-config');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { default: GuidesIndex } = await import('@/app/guides/page');
    const html = renderToStaticMarkup(await GuidesIndex());
    for (const { url } of satelliteGuides()) expect(html).toContain(`href="${url}"`);
    // Negative: the main-site guide list by itself names none of them.
    const own = new Set(guidesForHost(PARENT_HOST).map((page) => page.slug));
    expect(satelliteGuides().filter(({ page }) => own.has(page.slug))).toEqual([]);
  });
});
