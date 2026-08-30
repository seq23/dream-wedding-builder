import { NextRequest, NextResponse } from 'next/server';
import { aliasRedirectTarget, apexHost, canonicalHostForPath, hostConfig, isCanonicalHost, isPreviewHost } from '@/lib/site-config';

// Search Console verification files must be served verbatim at each domain root.
// The matcher catches everything outside _next, so without a passthrough the
// host-ownership rules would redirect the verification request and Google would
// never see the file.
const passthroughPrefixes = ['/api/', '/_next/', '/google'];
const passthroughExact = ['/favicon.ico'];

export function middleware(request: NextRequest) {
  const rawHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  const originalHost = rawHost.split(',')[0].trim().toLowerCase().split(':')[0];
  const host = apexHost(originalHost);
  const pathname = request.nextUrl.pathname;

  if (isPreviewHost(originalHost)) return NextResponse.next();

  // Alias hosts redirect before anything else, including the passthroughs below.
  // weddingpdfchecklist.com is printed inside five published Kindle EPUBs and is
  // attached to this Worker only so those links resolve; it must never render a
  // page, serve a robots.txt of its own, or carry a verification file, because
  // any of those would turn it into a second indexable copy of the site. The
  // path and query are preserved so a reader lands on the exact page the book
  // sent them to and the canonical URL is the one that gets recorded.
  const aliasTarget = aliasRedirectTarget(originalHost);
  if (aliasTarget) {
    const url = request.nextUrl.clone();
    url.protocol = 'https:';
    url.host = aliasTarget;
    url.port = '';
    return NextResponse.redirect(url, 301);
  }

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
