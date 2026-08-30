import { describe, expect, it } from 'vitest';
import { aliasRedirectTarget, apexHost, CANONICAL_HOSTS, canonicalHostForPath, guidesForHost, hostConfig, isCanonicalHost } from '@/lib/site-config';

describe('canonical host ownership', () => {
  it('normalizes www hosts to apex', () => expect(apexHost('www.weddingchecklistpdf.com:443')).toBe('weddingchecklistpdf.com'));
  it('owns the checklist trunk on the parent host', () => expect(canonicalHostForPath('/wedding-checklist')).toBe('weddingchecklistpdf.com'));
  it('owns the budget hub on the budget host', () => expect(canonicalHostForPath('/wedding-budget-spreadsheet')).toBe('weddingbudgetspreadsheet.com'));
  it('owns broad timeline guide on the timeline host', () => expect(canonicalHostForPath('/guides/wedding-day-timeline')).toBe('weddingtimelinetemplate.com'));
  it('defines satellite root redirects', () => expect(hostConfig['weddingseatingchartmaker.com'].root_target).toBe('/wedding-seating-chart'));
  it('keeps at least 16 authority guides per canonical host', () => {
    for (const host of CANONICAL_HOSTS) expect(guidesForHost(host).length).toBeGreaterThanOrEqual(16);
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
