import { buildPinfeed, PINFEED_HOST } from '@/lib/pinfeed';
import { apexHost, isCanonicalHost } from '@/lib/site-config';

// Pinterest RSS feed (see lib/pinfeed.ts). Only weddingchecklistpdf.com publishes
// one; the three sibling hosts answer 404 so there is never a second copy.
export const dynamic = 'force-dynamic';
export function GET(request: Request): Response {
  const host = apexHost(request.headers.get('x-forwarded-host') ?? request.headers.get('host'));
  if (isCanonicalHost(host) && host !== PINFEED_HOST) return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  return new Response(buildPinfeed(), { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
