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
import { canonicalUrl, CANONICAL_HOSTS, hostConfig, isCanonicalHost, PARENT_HOST, type SiteHost } from './site-config';

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
export const HOMEPAGE_SCHEMA_TYPES = ['WebSite', 'Organization', 'WebPage', 'BreadcrumbList', 'Article', 'FAQPage', 'HowTo'] as const;

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

type Breadcrumb = { name: string; canonical: string };

export function homeSchemaNodes(input: {
  host: SiteHost; path: string; headline: string; description: string;
  faqs: Array<{ question: string; answer: string }>; steps: string[];
  breadcrumbs: Breadcrumb[]; dateModified?: string;
}): Array<Record<string, unknown>> {
  const home = siteHome(input.host);
  const siteUrl = canonicalUrl(input.host, '/');
  const pageUrl = canonicalUrl(input.host, input.path);
  const orgId = `${ORGANIZATION.url}#organization`;
  const websiteId = `${siteUrl}#website`;
  const ctx = 'https://schema.org';
  return [
    { '@context': ctx, '@type': 'WebSite', '@id': websiteId, url: siteUrl, name: home.name, description: home.definition, inLanguage: 'en-US', publisher: { '@id': orgId } },
    { '@context': ctx, '@type': 'Organization', '@id': orgId, name: ORGANIZATION.name, url: ORGANIZATION.url, logo: canonicalUrl(PARENT_HOST, '/icon-512.png') },
    { '@context': ctx, '@type': 'WebPage', '@id': `${pageUrl}#webpage`, url: pageUrl, name: input.headline, description: home.definition, isPartOf: { '@id': websiteId }, inLanguage: 'en-US',
      primaryImageOfPage: { '@type': 'ImageObject', url: ogImageUrl(input.host), width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT },
      speakable: { '@type': 'SpeakableSpecification', cssSelector: [SPEAKABLE_SELECTOR] } },
    { '@context': ctx, '@type': 'BreadcrumbList', itemListElement: input.breadcrumbs.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: item.canonical })) },
    { '@context': ctx, '@type': 'Article', headline: input.headline, description: input.description, mainEntityOfPage: pageUrl, image: ogImageUrl(input.host), publisher: { '@type': 'Organization', '@id': orgId, name: ORGANIZATION.name, url: ORGANIZATION.url }, ...(input.dateModified ? { dateModified: input.dateModified } : {}) },
    { '@context': ctx, '@type': 'FAQPage', mainEntity: input.faqs.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) },
    { '@context': ctx, '@type': 'HowTo', name: input.headline, description: input.description, step: input.steps.map((text, index) => ({ '@type': 'HowToStep', position: index + 1, text })) }
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
