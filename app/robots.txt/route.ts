import { apexHost, isCanonicalHost, PARENT_HOST } from '@/lib/site-config';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const host = apexHost(request.headers.get('x-forwarded-host') ?? request.headers.get('host'));
  const canonical = isCanonicalHost(host) ? host : PARENT_HOST;
  const text = `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\nDisallow: /order\nDisallow: /dashboard\nDisallow: /pack\n\nSitemap: https://${canonical}/sitemap.xml\n`;
  return new Response(text, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=3600' } });
}
