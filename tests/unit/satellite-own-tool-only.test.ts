// Owner ruling 2026-11-03 (spry brain, Settled decisions): weddingchecklistpdf.com is
// the canonical main wedding site. Shared or general wedding guides live there only;
// weddingbudgetspreadsheet.com, weddingtimelinetemplate.com and
// weddingseatingchartmaker.com keep only pages about their own tool and send shared
// content to the main site. On 2026-11-06 weddingbudgetspreadsheet.com/guides,
// /wedding-budget-tradeoffs and weddingtimelinetemplate.com/guides/wedding-day-timeline
// still answered 200 on their satellite with a self-canonical. This is the one guard:
// a satellite may own, list in its sitemap, or render with its own canonical only the
// paths in route_ownership.json hosts.<host>.own_tool_paths; everything else requested
// on a satellite is one 301 to the same path on the main site.
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import ownership from '@/data/seo/route_ownership.json';
import { middleware } from '@/middleware';
import { GET as sitemap } from '@/app/sitemap.xml/route';
import { shippingPages } from '@/lib/authority-registry';
import { guideMetadata } from '@/lib/seo';
import { landingMetadata } from '@/components/PlannerLandingPage';
import { plannerLandings } from '@/data/planner-landings';
import { ownToolPaths, PARENT_HOST } from '@/lib/site-config';

const MAIN = ownership.parent_host;
const SATELLITES = Object.keys(ownership.hosts).filter((host) => host !== MAIN);
const INFRA = new Set(ownership.shared_host_routes);
const isOwnTool = (host: string, path: string) => ownToolPaths(host).includes(path);
const hit = (host: string, path: string) => middleware(new NextRequest(`https://${host}${path}`, { headers: { host } }));
const canonicalOf = (meta: { alternates?: { canonical?: unknown } | null }) => new URL(String(meta.alternates?.canonical));

describe('satellites keep only their own tool; shared guides live on the main site', () => {
  it('knows the three satellites and each one has a non-empty own-tool list', () => {
    expect(MAIN).toBe('weddingchecklistpdf.com');
    expect(PARENT_HOST).toBe(MAIN);
    expect(SATELLITES.sort()).toEqual(['weddingbudgetspreadsheet.com', 'weddingseatingchartmaker.com', 'weddingtimelinetemplate.com']);
    for (const host of SATELLITES) expect(ownToolPaths(host).length).toBeGreaterThan(0);
  });

  it('gives a satellite no route outside its own-tool list', () => {
    const owned = ownership.routes.filter((route) => SATELLITES.includes(route.host));
    expect(owned.length).toBeGreaterThan(0);
    for (const route of owned) expect(isOwnTool(route.host, route.path), `${route.host}${route.path} is not an own-tool page`).toBe(true);
  });

  it('lists only own-tool pages in each satellite sitemap', async () => {
    for (const host of SATELLITES) {
      const xml = await (await sitemap(new Request(`https://${host}/sitemap.xml`, { headers: { host } }))).text();
      const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]));
      expect(locs.length, host).toBeGreaterThan(0);
      for (const loc of locs) {
        expect(loc.host).toBe(host);
        expect(isOwnTool(host, loc.pathname), `${host} sitemap lists shared page ${loc.pathname}`).toBe(true);
      }
    }
  });

  it('301s every shared page asked for on a satellite straight to the main site, and serves own-tool pages', () => {
    const shared = [
      '/guides', '/editorial-policy', '/wedding-budget-tradeoffs', '/guides/wedding-day-timeline',
      ...ownership.routes.filter((route) => route.host === MAIN && route.indexable && route.path !== '/').map((route) => route.path),
      ...shippingPages.map((page) => `/guides/${page.slug}`)
    ];
    let checked = 0;
    for (const host of SATELLITES) {
      for (const path of new Set(shared)) {
        if (isOwnTool(host, path) || INFRA.has(path)) continue;
        const response = hit(host, path);
        expect(response.status, `${host}${path}`).toBe(301);
        expect(new URL(response.headers.get('location') ?? '').host, `${host}${path}`).not.toBe(host);
        checked += 1;
      }
      for (const path of ownToolPaths(host)) expect(hit(host, path).headers.get('location'), `${host}${path} must render`).toBeNull();
    }
    expect(checked).toBeGreaterThan(30);
  });

  it('never gives a shared guide or landing a satellite self-canonical', () => {
    let checked = 0;
    for (const page of shippingPages) {
      const path = `/guides/${page.slug}`;
      const canonical = canonicalOf(guideMetadata(page.slug));
      expect(canonical.pathname).toBe(path);
      if (SATELLITES.includes(canonical.host)) expect(isOwnTool(canonical.host, path), `${canonical.host}${path} is a shared guide with a satellite canonical`).toBe(true);
      checked += 1;
    }
    for (const landing of plannerLandings) {
      const canonical = canonicalOf(landingMetadata(landing.slug));
      if (SATELLITES.includes(canonical.host)) expect(isOwnTool(canonical.host, `/${landing.slug}`), `${canonical.host}/${landing.slug} is a shared landing with a satellite canonical`).toBe(true);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(10);
  });
});
