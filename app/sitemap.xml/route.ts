import contentRegistry from '@/data/authority/content_registry.json';
import productCatalog from '@/data/products/product_catalog.json';
import hubs from '@/data/seo/hub_pages.json';
import ownership from '@/data/seo/route_ownership.json';
import { isPublishablePath, isShippingSlug } from '@/lib/authority-registry';
import { apexHost, isCanonicalHost } from '@/lib/site-config';

export const dynamic = 'force-dynamic';

type Product = { id: string; domain?: string; route: string };
type AuthorityPage = { product_id: string; slug: string; updated_at?: string };
const products = (productCatalog.products ?? []) as Product[];
const pages = (contentRegistry.pages ?? []) as AuthorityPage[];

function xmlEscape(value: string): string { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char] ?? char); }

export async function GET(request: Request): Promise<Response> {
  const host = apexHost(request.headers.get('x-forwarded-host') ?? request.headers.get('host'));
  if (!isCanonicalHost(host)) return new Response('Unknown canonical host', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const product = products.find((item) => item.domain === host);
  if (!product) return new Response('Unknown canonical host', { status: 404 });
  const ownedRoutes = ownership.routes.filter((route) => route.host === host && route.indexable).map((route) => route.path);
  const guideIndex = '/guides';
  const urls = [...new Set([...ownedRoutes, guideIndex])].map((path) => ({ loc: `https://${host}${path === '/' ? '/' : path}`, lastmod: path.startsWith('/guides/') ? pages.find((page) => `/guides/${page.slug}` === path)?.updated_at : '2026-07-30' }));
  // Defensive inclusion: every hub and guide owner must appear even if the manifest is stale.
  for (const [slug, hub] of Object.entries(hubs.pages)) if (hub.host === host && !urls.some((item) => item.loc.endsWith(`/${slug}`))) urls.push({ loc: `https://${host}/${slug}`, lastmod: '2026-07-30' });
  for (const page of pages.filter((item) => item.product_id === product.id && isShippingSlug(item.slug))) if (!urls.some((item) => item.loc.endsWith(`/guides/${page.slug}`))) urls.push({ loc: `https://${host}/guides/${page.slug}`, lastmod: page.updated_at ?? '2026-07-30' });
  // Final gate. Every branch above has its own reason to add a URL; this is the one
  // place that decides whether the URL is allowed to ship, so a new branch cannot
  // reintroduce a 404 without going through it.
  const publishable = urls.filter((item) => isPublishablePath(new URL(item.loc).pathname));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${publishable.sort((a,b)=>a.loc.localeCompare(b.loc)).map((item) => `  <url><loc>${xmlEscape(item.loc)}</loc>${item.lastmod ? `<lastmod>${xmlEscape(item.lastmod)}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
  return new Response(xml, { status: 200, headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' } });
}
