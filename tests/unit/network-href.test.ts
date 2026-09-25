import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { middleware } from '@/middleware';
import ownership from '@/data/seo/route_ownership.json';
import registry from '@/data/authority/content_registry.json';
import guideMeta from '@/data/seo/guide_meta_descriptions.json';
import { CANONICAL_HOSTS, PARENT_HOST, canonicalHostForPath, hrefFrom } from '@/lib/site-config';
import { META_DESCRIPTION_MAX, META_DESCRIPTION_MIN, SITE_TITLE_SUFFIX, TITLE_MAX, documentTitle, guideMetaDescription } from '@/lib/seo';
import { shippingPages } from '@/lib/authority-registry';
import { plannerHref } from '@/lib/planner-seed';

// Bing Webmaster + site audit, 2026-09-25. The rendered-page gate
// (scripts/validators/validate_rendered_seo_contract.mjs) proves the built site;
// these pin the three functions it depends on so a regression names its cause.

describe('hrefFrom links the final URL, never a cross-host redirect', () => {
  const run = (host: string, path: string) =>
    middleware(new NextRequest(new Request(`https://${host}${path}`, { headers: { host } })));

  it('examines every owned route from every host', () => {
    expect(ownership.routes.length).toBeGreaterThan(0);
    expect(CANONICAL_HOSTS.length).toBe(4);
  });

  for (const from of CANONICAL_HOSTS) {
    for (const route of ownership.routes) {
      it(`${from} -> ${route.path}`, () => {
        const href = hrefFrom(from, route.path);
        const target = href.startsWith('https://') ? new URL(href) : new URL(href, `https://${from}`);
        // The URL the link resolves to must render on its own host: no 3XX.
        const response = run(target.host, target.pathname);
        expect(response.status, `${from} links ${route.path} as ${href}, which answers ${response.status}`).toBe(200);
        // Relative only when the current host owns it.
        if (!href.startsWith('https://')) expect(canonicalHostForPath(route.path) === from || route.path === '/').toBe(true);
      });
    }
  }

  it('keeps the query and hash on a cross-host planner link', () => {
    const rel = plannerHref({ focus: 'Budget + Tradeoffs', q: 'x' });
    expect(hrefFrom('weddingbudgetspreadsheet.com', `${rel}#top`)).toBe(`https://${PARENT_HOST}${rel}#top`);
    expect(hrefFrom(PARENT_HOST, rel)).toBe(rel);
  });

  it('links a product host\'s hub instead of its redirecting root', () => {
    expect(hrefFrom('weddingseatingchartmaker.com', '/')).toBe('/wedding-seating-chart');
    expect(hrefFrom(PARENT_HOST, '/')).toBe('/');
  });
});

describe('plain http is redirected to https, only when Cloudflare says so', () => {
  const host = 'weddingseatingchartmaker.com';
  const path = '/products/seating-chart-maker';

  it('cf-visitor scheme http answers a permanent redirect to the https URL', () => {
    const response = middleware(new NextRequest(new Request(`http://${host}${path}`, { headers: { host, 'cf-visitor': '{"scheme":"http"}', 'cf-ray': 'x' } })));
    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe(`https://${host}${path}`);
  });

  it('x-forwarded-proto http behind cf-ray also redirects', () => {
    const response = middleware(new NextRequest(new Request(`http://${host}${path}`, { headers: { host, 'x-forwarded-proto': 'http', 'cf-ray': 'x' } })));
    expect(response.status).toBe(301);
  });

  it('https and non-Cloudflare requests render', () => {
    expect(middleware(new NextRequest(new Request(`https://${host}${path}`, { headers: { host, 'cf-visitor': '{"scheme":"https"}' } }))).status).toBe(200);
    expect(middleware(new NextRequest(new Request(`http://${host}${path}`, { headers: { host } }))).status).toBe(200);
  });
});

describe('every guide meta description is 110-160 characters and unique', () => {
  const pages = registry.pages;
  it('examines every guide', () => { expect(pages.length).toBeGreaterThan(0); });

  it('each written description is in range and belongs to a real guide', () => {
    const written = guideMeta.descriptions as Record<string, string>;
    expect(Object.keys(written).length).toBeGreaterThan(0);
    for (const [slug, text] of Object.entries(written)) {
      expect(pages.some((page) => page.slug === slug), `${slug} is not a guide`).toBe(true);
      expect(text.length, slug).toBeGreaterThanOrEqual(META_DESCRIPTION_MIN);
      expect(text.length, slug).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
    }
  });

  it('every guide renders an in-range, distinct description', () => {
    const seen = new Map<string, string>();
    for (const page of pages) {
      const text = guideMetaDescription(page);
      expect(text.length, `${page.slug}: "${text}"`).toBeGreaterThanOrEqual(META_DESCRIPTION_MIN);
      expect(text.length, `${page.slug}: "${text}"`).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
      expect(seen.get(text), `${page.slug} duplicates ${seen.get(text)}`).toBeUndefined();
      seen.set(text, page.slug);
    }
  });

  it('the fallback extends a short summary and cuts a long one at a word', () => {
    const short = guideMetaDescription({ slug: '__none__', summary: 'Short summary sentence here.', answer: 'Short summary sentence here. Then a recommendation that carries on with specific detail about what to do next and why it matters.' });
    expect(short.length).toBeGreaterThanOrEqual(META_DESCRIPTION_MIN);
    expect(short.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
    const long = guideMetaDescription({ slug: '__none__', summary: 'word '.repeat(60).trim() });
    expect(long.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('rendered titles are 30-70 characters (Bing Site Scan "title too long")', () => {
  const rendered = (title: string) => {
    const value = documentTitle(title);
    return typeof value === 'string' ? `${value}${SITE_TITLE_SUFFIX}` : (value as { absolute: string }).absolute;
  };

  it('keeps the suffix only when it fits', () => {
    expect(rendered('Wedding Seating Chart for 150 Guests')).toBe('Wedding Seating Chart for 150 Guests | Dream Wedding Builder');
    expect(rendered('Wedding Seating Chart Maker - Editable Wedding Planning Tool')).toBe('Wedding Seating Chart Maker - Editable Wedding Planning Tool');
  });

  it('every shipping guide title renders in range', () => {
    expect(shippingPages.length).toBeGreaterThan(0);
    for (const page of shippingPages) {
      const title = rendered(page.title);
      expect(title.length, `${page.slug}: "${title}"`).toBeGreaterThanOrEqual(30);
      expect(title.length, `${page.slug}: "${title}"`).toBeLessThanOrEqual(TITLE_MAX);
    }
  });
});
