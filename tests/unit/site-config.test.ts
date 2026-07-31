import { describe, expect, it } from 'vitest';
import { apexHost, CANONICAL_HOSTS, canonicalHostForPath, guidesForHost, hostConfig } from '@/lib/site-config';

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
