import { NextRequest, NextResponse } from 'next/server';
import { apexHost, canonicalHostForPath, hostConfig, isCanonicalHost, isPreviewHost } from '@/lib/site-config';

const passthroughPrefixes = ['/api/', '/_next/'];
const passthroughExact = ['/favicon.ico'];

export function middleware(request: NextRequest) {
  const rawHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  const originalHost = rawHost.split(',')[0].trim().toLowerCase().split(':')[0];
  const host = apexHost(originalHost);
  const pathname = request.nextUrl.pathname;

  if (isPreviewHost(originalHost)) return NextResponse.next();

  if (originalHost.startsWith('www.') && isCanonicalHost(host)) {
    const url = request.nextUrl.clone();
    url.protocol = 'https:';
    url.host = host;
    return NextResponse.redirect(url, 308);
  }

  if (!isCanonicalHost(host)) return NextResponse.next();
  if (passthroughPrefixes.some((prefix) => pathname.startsWith(prefix)) || passthroughExact.includes(pathname)) return NextResponse.next();
  if (pathname === '/' && hostConfig[host].root_action === 'redirect') {
    const url = request.nextUrl.clone();
    url.pathname = hostConfig[host].root_target;
    return NextResponse.redirect(url, 308);
  }
  if (pathname === '/guides' || pathname === '/sitemap.xml' || pathname === '/robots.txt' || pathname === '/llms.txt') return NextResponse.next();

  const owner = canonicalHostForPath(pathname);
  if (owner && owner !== host) {
    const url = request.nextUrl.clone();
    url.protocol = 'https:';
    url.host = owner;
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)']
};
