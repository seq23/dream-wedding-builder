// Guards for two Search Readiness Checklist failures found on 26 Oct 2026.
//
// f6 (brand capture): weddingseatingchartmaker.com declared its WebSite name as
// "Wedding Seating Chart Maker" while its homepage title said "Wedding Seating
// Chart Planner", so the site did not state its own brand in the one place an
// engine reads it first.
//
// b3 (one H1): /free-wedding-planner shipped two <h1> elements, because
// BuilderEmailGate drew its own <h1> over a page that keeps rendering its own.
// aria-hidden and inert hide the covered page from assistive tech but not from a
// crawler, so both headings were in the markup.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ownership from '@/data/seo/route_ownership.json';
import { BuilderEmailGate } from '@/components/BuilderEmailGate';
import { siteHome } from '@/lib/site-home';
import { guideMetadata, guides, hubBySlug, hubMetadata, hubs, seoMetadata, TITLE_MAX } from '@/lib/seo';
import { hostForProduct } from '@/lib/site-config';
import { HOSTS } from './helpers/site-homes';
import { metadata as rootHomeMetadata } from '@/app/page';

const titleText = (t: unknown): string => (typeof t === 'string' ? t : String((t as { absolute?: string })?.absolute ?? ''));

// The title a crawler sees at https://<host>/, following the root redirect the
// middleware serves, which is exactly what the readiness check reads.
function homepageTitle(host: string): string {
  const cfg = (ownership.hosts as Record<string, { root_action: string; root_target: string }>)[host];
  if (cfg.root_action === 'render') return titleText(rootHomeMetadata.title);
  return hubBySlug(cfg.root_target.replace(/^\//, '')).title;
}

describe('brand capture: the homepage title states the site name (checklist f6)', () => {
  it('covers every canonical host', () => { expect(HOSTS.length).toBe(4); });
  for (const host of HOSTS) {
    it(host, () => {
      const name = siteHome(host).name;
      expect(name.length).toBeGreaterThan(0);
      expect(homepageTitle(host).toLowerCase()).toContain(name.toLowerCase());
    });
  }
});

describe('every page title names its owning site (checklist b10)', () => {
  const expectBrand = (metadata: { title?: unknown; openGraph?: unknown }, host: string) => {
    const title = titleText(metadata.title);
    expect(title.toLowerCase()).toContain(siteHome(host).name.toLowerCase());
    expect(title.length).toBeGreaterThanOrEqual(30);
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX);
    for (const sibling of HOSTS.filter((candidate) => candidate !== host)) {
      expect(title.toLowerCase()).not.toContain(siteHome(sibling).name.toLowerCase());
    }
    expect((metadata.openGraph as { siteName: string }).siteName).toBe(siteHome(host).name);
  };

  it('keeps the brand even when the topic cannot fit beside it in full', () => {
    for (const host of HOSTS) {
      expectBrand(seoMetadata({ title: 'A detailed wedding planning guide to owners, deadlines and handoffs', description: 'test', host, path: '/guides/test' }), host);
    }
  });

  it('checks every guide through the metadata its route actually exports', () => {
    for (const guide of guides) expectBrand(guideMetadata(guide.slug), hostForProduct(guide.product_id));
  });

  it('checks every hub through the metadata its route actually exports', () => {
    for (const [slug, hub] of Object.entries(hubs)) expectBrand(hubMetadata(slug), hub.host);
  });
});

describe('one H1 per page (checklist b3)', () => {
  const countH1 = (html: string) => (html.match(/<h1[\s>]/g) ?? []).length;

  it('the locked builder gate adds no second h1 over the page it covers', () => {
    const html = renderToStaticMarkup(
      <BuilderEmailGate><h1>Build the wedding around reality, not generic inspiration.</h1></BuilderEmailGate>
    );
    // The gate is showing (no unlock in this environment) and the covered page is
    // still in the markup, so this is the exact two-h1 shape that failed live.
    expect(html).toContain('data-testid="builder-email-gate"');
    expect(html).toContain('Build the wedding around reality');
    expect(countH1(html)).toBe(1);
  });

  it('the gate itself declares no h1', () => {
    const html = renderToStaticMarkup(<BuilderEmailGate><p>covered page</p></BuilderEmailGate>);
    expect(html).toContain('Enter your email to open the builder.');
    expect(countH1(html)).toBe(0);
  });

  for (const host of HOSTS) {
    const cfg = (ownership.hosts as Record<string, { root_action: string; root_target: string }>)[host];
    if (cfg.root_action === 'render') continue;
    it(`${host} hub page declares exactly one h1 in its data`, () => {
      expect(hubBySlug(cfg.root_target.replace(/^\//, '')).h1.trim().length).toBeGreaterThan(0);
    });
  }
});
