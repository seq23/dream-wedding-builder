/**
 * The one template for every canonical host's homepage: the definition paragraph
 * under the H1, the JSON-LD node set, and the per-host icon/share-card files.
 *
 * Why it exists: weddingchecklistpdf.com is the only host whose `/` renders its own
 * page (app/page.tsx, root_action "render"); the other three redirect `/` to a hub
 * rendered by components/seo/HubPage.tsx, which carried the JSON-LD. The bespoke
 * page never had any, so one site of four shipped no structured data and no
 * og:image. Both templates now call homeSchemaNodes(), so the type set is the same
 * on all four by construction, and tests/unit/seo-hygiene-jsonld.test.ts renders
 * both and compares them.
 */
import homes from '@/data/seo/site_homes.json';
import { SITE_ICON_FILES } from './site-icons.generated';
import { canonicalUrl, CANONICAL_HOSTS, hostConfig, isCanonicalHost, PARENT_HOST, productForHost, type SiteHost } from './site-config';

export type SiteHome = {
  name: string; short_name: string; initial: string; background: string; accent: string; tagline: string; definition: string;
  faqs?: Array<{ question: string; answer: string }>; steps?: string[];
};

export const SPEAKABLE_SELECTOR: string = homes.speakable_selector;
export const SITE_DEFINITION_ID = SPEAKABLE_SELECTOR.replace(/^#/, '');
export const ORGANIZATION = homes.organization;
export const OG_IMAGE_PATH = '/og.png';
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const HOMEPAGE_SCHEMA_TYPES = ['WebSite', 'Organization', 'WebPage', 'BreadcrumbList', 'Article', 'FAQPage', 'HowTo', 'Product'] as const;
// Every page carries these two, whatever else it carries: an engine cannot attribute
// a page to a publisher it cannot find, and a page with no WebPage node is a document
// with no stated relationship to the site it belongs to.
export const PAGE_FRAME_SCHEMA_TYPES = ['Organization', 'WebPage'] as const;

const siteHomes = homes.hosts as Record<string, SiteHome>;

export function siteHome(host: string): SiteHome {
  const resolved = isCanonicalHost(host) ? host : PARENT_HOST;
  const home = siteHomes[resolved];
  if (!home) throw new Error(`site_homes.json has no record for ${resolved}`);
  return home;
}

export function resolveSiteHost(raw?: string | null): SiteHost {
  const host = String(raw ?? '').split(',')[0].trim().toLowerCase().split(':')[0].replace(/^www\./, '');
  return isCanonicalHost(host) ? host : PARENT_HOST;
}

/** The path that is this host's homepage once `/` has been resolved (redirect target or `/`). */
export function homePathFor(host: SiteHost): string {
  return hostConfig[host].root_action === 'redirect' ? hostConfig[host].root_target : '/';
}

export function isHomePath(host: string, path: string): boolean {
  return isCanonicalHost(host) && homePathFor(host) === path;
}

export function ogImageUrl(host: string): string {
  return canonicalUrl(isCanonicalHost(host) ? host : PARENT_HOST, OG_IMAGE_PATH);
}

export function ogImages(host: string, alt: string) {
  return [{ url: ogImageUrl(host), width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt }];
}

export type Breadcrumb = { name: string; canonical: string };

const SCHEMA_CONTEXT = 'https://schema.org';
export const ORGANIZATION_ID = `${ORGANIZATION.url}#organization`;
export const websiteId = (host: SiteHost): string => `${canonicalUrl(host, '/')}#website`;

/**
 * The one Organization node. Every page emits this and nothing else emits an
 * Organization of its own, because an engine reads the first one it finds: four
 * templates each writing their own {name, url} publisher stub is how five of the
 * site's page kinds came to ship an Organization with no logo and no sameAs while
 * the homepage had both. Article and Product publishers reference it by @id.
 *
 * sameAs is the publisher's own profiles (data/seo/site_homes.json): it is what
 * tells an engine that four domains and that profile are one entity. Only accounts
 * this business controls belong in it - scripts/validate/live-check.mjs fetches
 * them after every deploy.
 */
export function organizationNode(): Record<string, unknown> {
  return {
    '@context': SCHEMA_CONTEXT, '@type': 'Organization', '@id': ORGANIZATION_ID,
    name: ORGANIZATION.name, url: ORGANIZATION.url,
    logo: canonicalUrl(PARENT_HOST, '/icon-512.png'),
    sameAs: [...ORGANIZATION.sameAs]
  };
}

export function webPageNode(input: { host: SiteHost; path: string; name: string; description: string }): Record<string, unknown> {
  const pageUrl = canonicalUrl(input.host, input.path);
  return {
    '@context': SCHEMA_CONTEXT, '@type': 'WebPage', '@id': `${pageUrl}#webpage`,
    url: pageUrl, name: input.name, description: input.description,
    isPartOf: { '@id': websiteId(input.host) }, inLanguage: 'en-US',
    publisher: { '@id': ORGANIZATION_ID },
    primaryImageOfPage: { '@type': 'ImageObject', url: ogImageUrl(input.host), width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT }
  };
}

export function breadcrumbListNode(items: Breadcrumb[]): Record<string, unknown> {
  return {
    '@context': SCHEMA_CONTEXT, '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: item.canonical }))
  };
}

/**
 * The frame every page carries, emitted once per page by app/layout.tsx: the one
 * Organization, this page's WebPage, and its breadcrumb trail.
 *
 * Why the layout and not each template: before this, schema was whatever the page's
 * own component happened to emit, so the sixteen pages built from plain JSX - the
 * guides index, the photo and trend catalogues, the shop, the four legal pages, the
 * planner, the suite page and the six planner landings - carried no structured data
 * at all, and five more carried a publisher with no logo and no sameAs. A frame that
 * every page must remember to add is a frame the next page will be missing.
 *
 * Nodes carry @id, so where a template emits its own richer WebPage or
 * BreadcrumbList for the same URL (the homepages through homeSchemaNodes, hubs and
 * guides through <Breadcrumbs>), the two describe one thing and merge rather than
 * contradict. Guarded page by page against the real build by
 * scripts/validators/validate_rendered_seo_contract.mjs.
 */
export function pageFrameNodes(input: { host: SiteHost; path: string; name: string; description: string; breadcrumbs: Breadcrumb[] }): Array<Record<string, unknown>> {
  return [organizationNode(), webPageNode(input), breadcrumbListNode(input.breadcrumbs)];
}

/**
 * The host's own paid product, as a Product with a priced Offer. The price comes
 * from the catalog, which is the same source the page's visible price and the
 * checkout both read, so schema and page cannot state different numbers - the
 * rendered-seo gate asserts the Offer price appears in the page's visible text.
 */
export function productNode(host: SiteHost): Record<string, unknown> | null {
  const product = productForHost(host);
  if (!product || !product.sku || !product.price) return null;
  const productUrl = canonicalUrl(product.domain as SiteHost, product.route);
  return {
    '@context': SCHEMA_CONTEXT, '@type': 'Product', name: product.name, description: product.promise,
    sku: product.sku, image: [canonicalUrl(product.domain as SiteHost, product.hero_image)],
    brand: { '@type': 'Brand', name: ORGANIZATION.name },
    offers: {
      '@type': 'Offer', price: String(product.price), priceCurrency: 'USD',
      availability: 'https://schema.org/InStock', url: productUrl,
      seller: { '@id': ORGANIZATION_ID }
    }
  };
}


export function homeSchemaNodes(input: {
  host: SiteHost; path: string; headline: string; description: string;
  faqs: Array<{ question: string; answer: string }>; steps: string[];
  breadcrumbs: Breadcrumb[]; dateModified?: string;
}): Array<Record<string, unknown>> {
  const home = siteHome(input.host);
  const siteUrl = canonicalUrl(input.host, '/');
  const pageUrl = canonicalUrl(input.host, input.path);
  const orgId = ORGANIZATION_ID;
  const siteId = websiteId(input.host);
  const ctx = SCHEMA_CONTEXT;
  return [
    { '@context': ctx, '@type': 'WebSite', '@id': siteId, url: siteUrl, name: home.name, description: home.definition, inLanguage: 'en-US', publisher: { '@id': orgId } },
    organizationNode(),
    { '@context': ctx, '@type': 'WebPage', '@id': `${pageUrl}#webpage`, url: pageUrl, name: input.headline, description: home.definition, isPartOf: { '@id': siteId }, inLanguage: 'en-US',
      primaryImageOfPage: { '@type': 'ImageObject', url: ogImageUrl(input.host), width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT },
      speakable: { '@type': 'SpeakableSpecification', cssSelector: [SPEAKABLE_SELECTOR] } },
    { '@context': ctx, '@type': 'BreadcrumbList', itemListElement: input.breadcrumbs.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: item.canonical })) },
    { '@context': ctx, '@type': 'Article', headline: input.headline, description: input.description, mainEntityOfPage: pageUrl, image: ogImageUrl(input.host), publisher: { '@id': orgId }, ...(input.dateModified ? { dateModified: input.dateModified } : {}) },
    { '@context': ctx, '@type': 'FAQPage', mainEntity: input.faqs.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) },
    { '@context': ctx, '@type': 'HowTo', name: input.headline, description: input.description, step: input.steps.map((text, index) => ({ '@type': 'HowToStep', position: index + 1, text })) },
    // The priced Offer. Four homepages showed a price in their own text and none of
    // them said so in schema, so no result could ever carry it. Null only if the
    // host has no catalog product, which route_ownership.json does not allow.
    ...(productNode(input.host) ? [productNode(input.host) as Record<string, unknown>] : [])
  ];
}

export const SITE_ICON_ROUTES = {
  'favicon.ico': 'image/x-icon',
  'apple-touch-icon.png': 'image/png',
  'icon-192.png': 'image/png',
  'icon-512.png': 'image/png',
  'og.png': 'image/png'
} as const;
export type SiteIconFile = keyof typeof SITE_ICON_ROUTES;

export function siteIconBytes(host: string, file: SiteIconFile): Uint8Array {
  const resolved = isCanonicalHost(host) ? host : PARENT_HOST;
  const b64 = SITE_ICON_FILES[resolved]?.[file];
  if (!b64) throw new Error(`no ${file} generated for ${resolved}; run scripts/seo/generate_site_icons.py`);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function siteIconResponse(rawHost: string | null, file: SiteIconFile): Response {
  return new Response(siteIconBytes(resolveSiteHost(rawHost), file) as BodyInit, {
    headers: { 'Content-Type': SITE_ICON_ROUTES[file], 'Cache-Control': 'public, max-age=86400', Vary: 'Host' }
  });
}

export function siteManifest(rawHost: string | null) {
  const host = resolveSiteHost(rawHost);
  const home = siteHome(host);
  return {
    name: home.name, short_name: home.short_name, description: home.definition,
    start_url: '/', scope: '/', display: 'standalone',
    background_color: '#FFFDF9', theme_color: home.background,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
    ]
  };
}

export const SITE_HOME_HOSTS: readonly SiteHost[] = CANONICAL_HOSTS;
