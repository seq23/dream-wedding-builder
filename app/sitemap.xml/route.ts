import contentRegistry from '@/data/authority/content_registry.json';
import productCatalog from '@/data/products/product_catalog.json';

export const dynamic = 'force-dynamic';

type Product = { id: string; domain?: string; route: string };
type AuthorityPage = { product_id: string; slug: string };

const products = (productCatalog.products ?? []) as Product[];
const pages = (contentRegistry.pages ?? []) as AuthorityPage[];
const allowedHosts = new Set(products.map((product) => product.domain).filter(Boolean) as string[]);

function xmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  })[char] ?? char);
}

export async function GET(request: Request): Promise<Response> {
  const forwarded = request.headers.get('x-forwarded-host');
  const rawHost = (forwarded ?? request.headers.get('host') ?? '').split(',')[0].trim().toLowerCase();
  const host = rawHost.split(':')[0];
  if (!allowedHosts.has(host)) {
    return new Response('Unknown canonical host', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  }
  const product = products.find((item) => item.domain === host);
  if (!product) return new Response('Unknown canonical host', { status: 404 });
  const urls = [
    `https://${host}/`,
    `https://${host}${product.route}`,
    ...pages.filter((page) => page.product_id === product.id).map((page) => `https://${host}/guides/${page.slug}`)
  ];
  const unique = [...new Set(urls)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${unique.map((url) => `  <url><loc>${xmlEscape(url)}</loc></url>`).join('\n')}\n</urlset>\n`;
  return new Response(xml, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
    }
  });
}
