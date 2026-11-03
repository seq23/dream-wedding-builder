import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { GET } from '@/app/sitemap.xml/route';
import { shippingPages } from '@/lib/authority-registry';
import rescue from '@/data/seo/budget_rescue.json';
import frozen from '@/data/release/frozen_output_registry.json';

describe('budget consolidation', () => {
  it('301s every retired URL and slash variant directly to a kept hub on every sibling host', () => {
    expect(Object.keys(rescue.redirects).length).toBe(16);
    for (const [path, target] of Object.entries(rescue.redirects)) {
      for (const host of [rescue.host, 'weddingchecklistpdf.com', 'weddingtimelinetemplate.com', 'weddingseatingchartmaker.com']) {
        for (const suffix of ['', '/']) {
          const response = middleware(new NextRequest(`https://${host}${path}${suffix}?utm_source=test`, { headers: { host } }));
          expect(response.status).toBe(301);
          expect(response.headers.get('location')).toBe(`https://${rescue.host}${target}?utm_source=test`);
          expect(target in rescue.redirects).toBe(false);
        }
      }
      expect(shippingPages.some((p) => `/guides/${p.slug}` === path)).toBe(false);
      expect(path in frozen.records).toBe(false);
    }
  });
  it('advertises only the nine retained URLs and preserves the previously visible cost-per-guest hub', async () => {
    const response = await GET(new Request(`https://${rescue.host}/sitemap.xml`, { headers: { host: rescue.host } }));
    const urls = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    expect(urls.length).toBe(9);
    expect(urls).toContain('/wedding-cost-per-guest');
    for (const path of Object.keys(rescue.redirects)) expect(urls).not.toContain(path);
    expect(shippingPages.filter((p) => p.product_id === 'budget-spreadsheet').map((p) => p.slug).sort()).toEqual([...rescue.kept_guides].sort());
  });
});
