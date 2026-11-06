// The domains bought for the free Builder (6 Nov 2026) answer with one 301 to the
// Builder's single canonical URL, at the step each is named for, and never render.
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { builderStepLinks } from '@/components/AppShell';

const hit = (host: string, path = '/') => middleware(new NextRequest(`https://${host}${path}`, { headers: { host } }));

describe('Builder domains', () => {
  it.each([
    ['weddingplannerfree.com', 'https://weddingchecklistpdf.com/free-wedding-planner'],
    ['www.weddingplannerfree.com', 'https://weddingchecklistpdf.com/free-wedding-planner'],
    ['weddingplanningtimeline.com', 'https://weddingchecklistpdf.com/free-wedding-planner#your-date'],
    ['aiweddingplannerfree.com', 'https://weddingchecklistpdf.com/free-wedding-planner#ai-draft']
  ])('%s / is one 301 to %s', (host, target) => {
    const res = hit(host);
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe(target);
  });

  it('keeps the seed in the query string', () => {
    expect(hit('weddingplannerfree.com', '/?guests=120&season=summer').headers.get('location')).toBe('https://weddingchecklistpdf.com/free-wedding-planner?guests=120&season=summer');
  });

  it('robots.txt and the sitemap redirect too, so the domain is never a second indexable copy', () => {
    for (const p of ['/robots.txt', '/sitemap.xml', '/dashboard']) {
      const res = hit('weddingplannerfree.com', p);
      expect(res.status).toBe(301);
      expect(res.headers.get('location')).toBe(`https://weddingchecklistpdf.com${p}`);
    }
  });

  it('the live sites still render their own pages (no redirect away)', () => {
    for (const [host, path] of [['weddingbudgetspreadsheet.com', '/wedding-budget-spreadsheet'], ['weddingtimelinetemplate.com', '/wedding-timeline-template'], ['weddingseatingchartmaker.com', '/wedding-seating-chart'], ['weddingchecklistpdf.com', '/free-wedding-planner']]) {
      expect(hit(host, path).status, `${host}${path}`).toBe(200);
    }
  });

  it('each live site links to the matching Builder step on the canonical URL', () => {
    expect(builderStepLinks['weddingbudgetspreadsheet.com'].href).toMatch(/^https:\/\/weddingchecklistpdf\.com\/free-wedding-planner\?focus=Budget.*#step-3$/);
    expect(builderStepLinks['weddingtimelinetemplate.com'].href).toMatch(/#your-date$/);
    expect(builderStepLinks['weddingseatingchartmaker.com'].href).toMatch(/#step-0$/);
    expect(builderStepLinks['weddingchecklistpdf.com'].href).toMatch(/#your-date$/);
  });
});
