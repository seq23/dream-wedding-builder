import ownership from '@/data/seo/route_ownership.json';
import registry from '@/data/authority/content_registry.json';
import { shippingPages } from '@/lib/authority-registry';
import { products } from '@/lib/products';

export type SiteHost = keyof typeof ownership.hosts;
export const PARENT_HOST = ownership.parent_host as SiteHost;
export const CANONICAL_HOSTS = Object.keys(ownership.hosts) as SiteHost[];

export function normalizeHost(raw?: string | null): string {
  return String(raw ?? '').split(',')[0].trim().toLowerCase().split(':')[0];
}

export function apexHost(raw?: string | null): string {
  const host = normalizeHost(raw);
  return host.startsWith('www.') ? host.slice(4) : host;
}

export function isCanonicalHost(host: string): host is SiteHost {
  return CANONICAL_HOSTS.includes(host as SiteHost);
}

export function isPreviewHost(host: string): boolean {
  return !host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.pages.dev') || /^127\./.test(host);
}

// Alias hosts are domains the Worker answers on but never publishes from.
//
// weddingpdfchecklist.com exists because five finished Kindle titles print
// https://weddingpdfchecklist.com/amazon/<slug> on their last page. The domain
// transposes the canonical one, and the link is inside EPUBs that are already
// on sale, so the only way to change it is to re-upload five books. The domain
// therefore has to answer - but it must not become a second copy of the site.
//
// Every request on an alias host is answered with a permanent redirect to the
// same path on its canonical host. Nothing renders here, so there is no second
// indexable copy to split rankings or confuse a canonical tag, and because the
// path survives the hop the canonical page records the visit under its own
// per-slug URL exactly as a direct arrival would.
export type AliasHostConfig = { redirects_to: SiteHost; status: number; indexable: boolean; reason: string; book_paths: string[] };
export const aliasHosts = (ownership.alias_hosts ?? {}) as Record<string, AliasHostConfig>;
export const ALIAS_HOSTS = Object.keys(aliasHosts);

export function isAliasHost(host: string): boolean {
  return Object.prototype.hasOwnProperty.call(aliasHosts, host);
}

// Returns the canonical host an alias host must redirect to, or null when the
// host is not an alias. Both the apex and its www. form resolve to the same
// target, because a reader who types www. in front of a printed URL must not
// land on a dead name.
export function aliasRedirectTarget(rawHost: string): SiteHost | null {
  const host = apexHost(rawHost);
  const alias = aliasHosts[host];
  if (!alias) return null;
  return isCanonicalHost(alias.redirects_to) ? alias.redirects_to : PARENT_HOST;
}

export const productsWithDomains = products.filter(
  (product): product is typeof product & { domain: SiteHost } => isCanonicalHost(product.domain)
);

export const hostConfig = ownership.hosts as Record<SiteHost, { root_action: string; root_target: string; product_id: string }>;

const routeOwners = new Map<string, SiteHost>(
  ownership.routes.map((route) => [route.path, route.host as SiteHost])
);
const productHosts = new Map<string, SiteHost>(
  productsWithDomains.map((product) => [product.id, product.domain])
);
const guideHosts = new Map<string, SiteHost>(
  registry.pages.map((page) => [page.slug, productHosts.get(page.product_id) ?? PARENT_HOST])
);

export function canonicalUrl(host: string, path = '/'): string {
  return `https://${host}${path === '/' ? '/' : path}`;
}

export function canonicalHostForPath(pathname: string): SiteHost | null {
  const exact = routeOwners.get(pathname);
  if (exact) return exact;
  const guideMatch = pathname.match(/^\/guides\/([^/]+)\/?$/);
  if (guideMatch) return guideHosts.get(guideMatch[1]) ?? null;
  const productMatch = pathname.match(/^\/products\/([^/]+)\/?$/);
  if (productMatch) {
    const product = productsWithDomains.find((item) => item.id === productMatch[1]);
    return product?.domain ?? PARENT_HOST;
  }
  if (pathname.startsWith('/admin')) return PARENT_HOST;
  if (pathname.startsWith('/order') || pathname.startsWith('/dashboard') || pathname.startsWith('/pack')) return PARENT_HOST;
  if (pathname.startsWith('/shop') || pathname === '/build' || pathname === '/photos' || pathname === '/trends') return PARENT_HOST;
  if (['/privacy', '/disclaimer', '/terms', '/refund-policy'].includes(pathname)) return PARENT_HOST;
  return null;
}

// The guide index links every page this returns, so it must return only pages
// that render. Unfiltered it linked the fan-out skeletons, which 404 - the same
// defect the sitemap had, on an internal-link surface instead of an external one.
export function guidesForHost(host: string) {
  const resolved = isCanonicalHost(host) ? host : PARENT_HOST;
  return shippingPages.filter((page) => productHosts.get(page.product_id) === resolved);
}

export function productForHost(host: string) {
  const resolved = isCanonicalHost(host) ? host : PARENT_HOST;
  return productsWithDomains.find((product) => product.domain === resolved);
}

export function hostForProduct(productId: string): SiteHost {
  return productHosts.get(productId) ?? PARENT_HOST;
}

export function currentSiteName(host: string): string {
  const product = productForHost(host);
  return product?.name ?? 'Dream Wedding Builder';
}
