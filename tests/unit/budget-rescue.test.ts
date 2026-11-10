import hubs from '@/data/seo/hub_pages.json';
import ownership from '@/data/seo/route_ownership.json';
import pageRescue from '@/data/seo/page_rescue.json';
import engineLedger from '@/data/search-loop/pages.json';
import { canonicalHostForPath, CANONICAL_HOSTS, hrefFrom, ownToolPaths } from '@/lib/site-config';
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
      // The kept hub is the budget tool hub, or since 2026-11-06 a shared budget
      // landing that now lives on the main site: one hop to whichever owns it.
      const owner = canonicalHostForPath(target);
      expect(owner).toBe(ownToolPaths(rescue.host).includes(target) ? rescue.host : pageRescue.main_host);
      for (const host of [rescue.host, 'weddingchecklistpdf.com', 'weddingtimelinetemplate.com', 'weddingseatingchartmaker.com']) {
        for (const suffix of ['', '/']) {
          const response = middleware(new NextRequest(`https://${host}${path}${suffix}?utm_source=test`, { headers: { host } }));
          expect(response.status).toBe(301);
          expect(response.headers.get('location')).toBe(`https://${owner}${target}?utm_source=test`);
          expect(target in rescue.redirects).toBe(false);
        }
      }
      expect(shippingPages.some((p) => `/guides/${p.slug}` === path)).toBe(false);
      expect(path in frozen.records).toBe(false);
    }
  });
  it('advertises only the five budget-tool URLs and keeps the cost-per-guest hub listed on the main site', async () => {
    const response = await GET(new Request(`https://${rescue.host}/sitemap.xml`, { headers: { host: rescue.host } }));
    const urls = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    expect(urls.length).toBe(5);
    expect(urls.sort()).toEqual(ownToolPaths(rescue.host).sort());
    const main = pageRescue.main_host;
    const mainUrls = [...(await (await GET(new Request(`https://${main}/sitemap.xml`, { headers: { host: main } }))).text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    expect(mainUrls).toContain('/wedding-cost-per-guest');
    expect(mainUrls).toContain('/wedding-budget-tradeoffs');
    for (const path of Object.keys(rescue.redirects)) expect([...urls, ...mainUrls]).not.toContain(path);
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
      // Kept paths plus the Search Loop's live question pages on this host, exactly (a live
      // engine page is a real page and must be in the sitemap; a merged one must not).
      const enginePaths = engineLedger.pages.filter((p) => p.status === 'live' && new URL(p.url).host === host).map((p) => p.route);
      expect(urls.map(u => u.pathname).sort()).toEqual([...new Set([...pageRescue.kept_paths_by_host[host], ...enginePaths])].sort());
      for (const url of urls) expect(url.host).toBe(host);
      const text = await (await llms(new Request(`https://${host}/llms.txt`, { headers: { host } }))).text();
      for (const match of text.matchAll(/\]\((https:\/\/[^)]+)\)/g)) {
        const url = new URL(match[1]);
        // A satellite links its own-tool pages on itself and shared pages on the main site.
        const own = host === pageRescue.main_host || ownToolPaths(host).includes(url.pathname) || ['/', '/sitemap.xml'].includes(url.pathname);
        expect(url.host, match[1]).toBe(own ? host : pageRescue.main_host);
        expect(url.pathname in pageRescue.redirects).toBe(false);
      }
    }
  });
  it('lists only current own-topic pages on companion home hubs', () => {
    const homes = Object.entries(ownership.hosts).filter(([host]) => host !== pageRescue.main_host);
    expect(homes.length).toBe(3);
    for (const [host, config] of homes) {
      const hub = hubs.pages[config.root_target.slice(1) as keyof typeof hubs.pages];
      expect(hub.related.length).toBeGreaterThan(0);
      for (const path of hub.related) {
        expect(path in pageRescue.redirects).toBe(false);
        // Own-tool pages link in place; shared guides link straight to the main site.
        if (ownToolPaths(host).includes(path)) {
          expect(hrefFrom(host, path)).toBe(path);
          expect(canonicalHostForPath(path)).toBe(host);
        } else {
          expect(canonicalHostForPath(path)).toBe(pageRescue.main_host);
          expect(hrefFrom(host, path)).toBe(`https://${pageRescue.main_host}${path}`);
        }
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
