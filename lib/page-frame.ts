/**
 * The name and the breadcrumb trail for any path on any host, resolved from the
 * records that already describe the page - so the structured-data frame
 * app/layout.tsx emits on every page cannot drift from what the page is.
 *
 * Why it exists: schema used to be whatever each page component remembered to
 * emit. Sixteen indexable pages built from plain JSX emitted none at all (the
 * guides index, the photo and trend catalogues, the shop, four legal pages, the
 * planner, the suite page, six planner landings), which is three of the Search
 * Readiness checklist's phase-C items failing on pages nobody had touched in
 * months. A frame each template must remember is a frame the next page will be
 * missing, so the layout emits it and this module tells the layout what the page
 * is called.
 *
 * Nothing here invents a name. Every lookup reads a record that already names the
 * page - hub_pages.json, the planner landings, the content registry, the product
 * catalog, or lib/site-directory.ts's own label table - and the fallback is the
 * site's name, never a title-cased slug dressed up as a heading.
 */
import registry from '@/data/authority/content_registry.json';
import hubsJson from '@/data/seo/hub_pages.json';
import { products, suite } from '@/lib/products';
import { canonicalHostForPath, canonicalUrl, isCanonicalHost, PARENT_HOST, type SiteHost } from '@/lib/site-config';
import { labelFor } from '@/lib/site-directory';
import { homePathFor, siteHome, type Breadcrumb } from '@/lib/site-home';

// The routes lib/site-directory.ts deliberately has no label for, because another
// surface links them (its COVERED_EXACT list). They still need a name here: a page
// linked from the nav is exactly as entitled to a WebPage node as one linked from
// the footer directory.
const NAV_LABELS: Record<string, string> = {
  '/guides': 'Wedding planning guides',
  '/shop': 'Wedding planning tools and prices',
  '/shop/compare': 'Compare the wedding planning tools',
  '/free-wedding-planner': 'Free wedding planner',
  '/privacy': 'Privacy policy',
  '/terms': 'Terms of use',
  '/disclaimer': 'Disclaimer',
  '/refund-policy': 'Refund policy',
  '/amazon': 'For book readers',
  '/about': 'About Dream Wedding Builder',
  '/editorial-policy': 'Editorial policy'
};

const hubPages = hubsJson.pages as Record<string, { title: string; host: string }>;
const guideTitles = new Map(registry.pages.map((page) => [page.slug, page.title] as const));

/** The page's own name, or null when no record in this repo names it. */
export function pageNameFor(path: string): string | null {
  const clean = path.replace(/[?#].*$/, '').replace(/\/+$/, '') || '/';
  if (NAV_LABELS[clean]) return NAV_LABELS[clean];
  const guide = clean.match(/^\/guides\/([^/]+)$/);
  if (guide) return guideTitles.get(guide[1]) ?? null;
  const product = clean.match(/^\/products\/([^/]+)$/);
  if (product) {
    if (product[1] === suite.id) return suite.name;
    return products.find((item) => item.id === product[1])?.name ?? null;
  }
  const hub = hubPages[clean.slice(1)];
  if (hub) return hub.title.split(':')[0].trim();
  return labelFor(clean);
}

/**
 * Home → section → this page. The section hop is emitted only where a real index
 * page owns the children (/guides, /shop, /amazon, /products): inventing an
 * intermediate crumb for a path that has no index page would mark up a trail the
 * site does not have.
 */
export function breadcrumbTrail(rawHost: string, path: string, name?: string | null): Breadcrumb[] {
  const host = (isCanonicalHost(rawHost) ? rawHost : PARENT_HOST) as SiteHost;
  // A crumb points at the host that owns the path, never at the current host with a
  // redirect waiting: /shop is the parent host's even when the crumb is rendered on
  // a product host.
  const crumbUrl = (p: string) => canonicalUrl(canonicalHostForPath(p) ?? host, p);
  const clean = path.replace(/[?#].*$/, '').replace(/\/+$/, '') || '/';
  const homePath = homePathFor(host);
  const trail: Breadcrumb[] = [{ name: siteHome(host).name, canonical: canonicalUrl(host, homePath) }];
  if (clean === '/' || clean === homePath) return trail;
  for (const section of ['/guides', '/shop', '/amazon', '/products']) {
    if (clean.startsWith(`${section}/`)) {
      const sectionName = section === '/products' ? NAV_LABELS['/shop'] : pageNameFor(section);
      const sectionPath = section === '/products' ? '/shop' : section;
      if (sectionName) trail.push({ name: sectionName, canonical: crumbUrl(sectionPath) });
      break;
    }
  }
  trail.push({ name: name || pageNameFor(clean) || siteHome(host).name, canonical: crumbUrl(clean) });
  return trail;
}
