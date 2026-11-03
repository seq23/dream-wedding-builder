import pageRescue from '@/data/seo/page_rescue.json';
import { canonicalHostForPath, CANONICAL_HOSTS, hrefFrom } from '@/lib/site-config';
import { GET as llms } from '@/app/llms.txt/route';
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

describe('wedding editorial consolidation and domain isolation', () => {
  it('keeps the exact nonempty guide ledger and never restores a retired route', () => {
    expect(pageRescue.kept_guides.length).toBeGreaterThan(0);
    expect(shippingPages.map(p => p.slug).sort()).toEqual([...pageRescue.kept_guides].sort());
    expect(Object.keys(pageRescue.redirects).length).toBeGreaterThan(0);
    for (const path of Object.keys(pageRescue.redirects)) expect(path in frozen.records).toBe(false);
  });
  it('redirects every retired path in one 301 from every host, preserving attribution and resolving links', () => {
    const retired = { ...rescue.redirects, ...pageRescue.redirects };
    for (const [path, target] of Object.entries(pageRescue.redirects)) for (const host of CANONICAL_HOSTS) {
      const owner = canonicalHostForPath(target);
      expect(owner).toBeTruthy();
      expect(target in retired).toBe(false);
      for (const slash of ['', '/']) {
        const response = middleware(new NextRequest(`https://${host}${path}${slash}?utm_source=test`, { headers: { host } }));
        expect(response.status).toBe(301);
        expect(response.headers.get('location')).toBe(`https://${owner}${target}?utm_source=test`);
      }
      const destination = `https://${owner}${target}`;
      expect(middleware(new NextRequest(destination, { headers: { host: owner! } })).headers.get('location')).toBeNull();
      expect(hrefFrom(host, `${path}?utm_source=test`)).toBe(`${owner === host ? '' : `https://${owner}`}${target}?utm_source=test`);
    }
  });
  it('publishes exactly each host’s kept sitemap and only same-host llms links', async () => {
    for (const host of CANONICAL_HOSTS) {
      const response = await GET(new Request(`https://${host}/sitemap.xml`, { headers: { host } }));
      const urls = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]));
      expect(urls.length).toBeGreaterThan(0);
      expect(urls.map(u => u.pathname).sort()).toEqual([...pageRescue.kept_paths_by_host[host]].sort());
      for (const url of urls) expect(url.host).toBe(host);
      const text = await (await llms(new Request(`https://${host}/llms.txt`, { headers: { host } }))).text();
      for (const match of text.matchAll(/\]\((https:\/\/[^)]+)\)/g)) {
        const url = new URL(match[1]);
        expect(url.host).toBe(host);
        expect(url.pathname in pageRescue.redirects).toBe(false);
      }
    }
  });
  it('serves shared planning only on the main site while leaving operational routes available', () => {
    for (const host of CANONICAL_HOSTS.filter(h => h !== pageRescue.main_host)) {
      for (const path of ['/questions/example-question', '/wedding-guest-list-template', '/what-to-do-6-months-before-the-wedding']) {
        const response = middleware(new NextRequest(`https://${host}${path}`, { headers: { host } }));
        expect(response.status).toBe(301);
        expect(response.headers.get('location')).toBe(`https://${pageRescue.main_host}${path}`);
      }
    }
    for (const host of CANONICAL_HOSTS) for (const path of ['/api/checkout', '/admin', '/privacy', '/terms', '/order/success']) {
      expect(path in pageRescue.redirects).toBe(false);
      expect(middleware(new NextRequest(`https://${host}${path}`, { headers: { host } })).status).not.toBe(404);
    }
  });
});
