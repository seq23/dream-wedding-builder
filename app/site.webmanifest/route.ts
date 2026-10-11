import { siteManifest } from '@/lib/site-home';

export const dynamic = 'force-dynamic';
export function GET(request: Request) {
  return new Response(JSON.stringify(siteManifest(request.headers.get('x-forwarded-host') ?? request.headers.get('host'))), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=86400', Vary: 'Host' }
  });
}
