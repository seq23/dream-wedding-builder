import hubs from '@/data/seo/hub_pages.json';
import registry from '@/data/authority/content_registry.json';
import products from '@/data/products/product_catalog.json';
import { apexHost, isCanonicalHost, PARENT_HOST } from '@/lib/site-config';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const raw = apexHost(request.headers.get('x-forwarded-host') ?? request.headers.get('host'));
  const host = isCanonicalHost(raw) ? raw : PARENT_HOST;
  const product = products.products.find((item) => 'domain' in item && item.domain === host);
  const ownedHubs = Object.entries(hubs.pages).filter(([, page]) => page.host === host);
  const ownedGuides = registry.pages.filter((page) => page.product_id === product?.id);
  const lines = [`# ${product?.name ?? 'Dream Wedding Builder'}`, '', 'Practical wedding planning guides, transparent paid-product previews, and protected working tools. Educational only; verify venue, vendor, contract, legal, dietary, accessibility, price, and timing requirements with the relevant source.', '', '## Priority pages', ...ownedHubs.map(([slug, page]) => `- [${page.title}](https://${host}/${slug})`), ...ownedGuides.slice(0, 24).map((page) => `- [${page.title}](https://${host}/guides/${page.slug})`), '', `- [All guides](https://${host}/guides)`, `- [Sitemap](https://${host}/sitemap.xml)`];
  return new Response(lines.join('\n') + '\n', { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=3600' } });
}
