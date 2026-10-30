import { NextRequest, NextResponse } from 'next/server';
import { aliasRedirectTarget, apexHost, canonicalHostForPath, hostConfig, isCanonicalHost, isPreviewHost } from '@/lib/site-config';
import { PATHNAME_HEADER } from '@/lib/pathname-header';

// Search Console verification files must be served verbatim at each domain root.
// The matcher catches everything outside _next, so without a passthrough the
// host-ownership rules would redirect the verification request and Google would
// never see the file.
const passthroughPrefixes = ['/api/', '/_next/', '/google'];
// The first path segment of every route this app serves, which is what tells an
// unknown path from a real one before Next's router sees it. Kept honest by
// tests/unit/middleware-trailing-slash.test.ts, which reads the app directory and
// fails if a route segment is missing here or a dead one is left behind.
export const ROUTE_SEGMENTS = [
  'about', 'admin', 'amazon', 'api', 'apple-touch-icon.png', 'backyard-wedding-planning',
  'dashboard', 'disclaimer', 'editorial-policy', 'favicon.ico', 'free-wedding-planner', 'guides',
  'icon-192.png', 'icon-512.png', 'llms.txt', 'methodology', 'micro-wedding-planning',
  'og.png', 'order', 'pack', 'photos', 'pinfeed', 'pinfeed.xml',
  'printable-wedding-checklist', 'privacy', 'products', 'readiness-score', 'refund-policy',
  'robots.txt', 'shop', 'site.webmanifest', 'sitemap.xml', 'terms', 'trends',
  'wedding-budget-spreadsheet', 'wedding-budget-tradeoffs', 'wedding-checklist',
  'wedding-checklist-pdf', 'wedding-cost-per-guest', 'wedding-guest-list-template',
  'wedding-planning-checklist', 'wedding-planning-reality-check', 'wedding-seating-chart',
  'wedding-timeline-template', 'what-to-do-6-months-before-the-wedding'
];
// Per-host icons, manifest and share card (app/<file>/route.ts) answer on every host.
const passthroughExact = ['/favicon.ico', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png', '/og.png', '/site.webmanifest'];

// The scheme the visitor actually used, as Cloudflare reports it to the Worker.
// Returns null when the request did not come through Cloudflare (local `next
// start`, tests), so nothing outside production is ever redirected by scheme.
export function visitorScheme(request: NextRequest): 'http' | 'https' | null {
  const visitor = request.headers.get('cf-visitor');
  if (visitor) {
    try {
      const scheme = JSON.parse(visitor)?.scheme;
      if (scheme === 'http' || scheme === 'https') return scheme;
    } catch { /* malformed header: fall through */ }
  }
  if (request.headers.get('cf-ray')) {
    const forwarded = (request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.replace(':', '')).split(',')[0].trim().toLowerCase();
    if (forwarded === 'http' || forwarded === 'https') return forwarded;
  }
  return null;
}

/** Passes the request through with its pathname attached for app/layout.tsx. */
function withPathname(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

/**
 * Trailing slashes, handled here rather than by Next's own redirect.
 *
 * Next answers any path ending in `/` with a 308 to the same path without it,
 * before middleware runs. For a real route that is correct and is kept. For a path
 * that does not exist it means a made-up URL answers 308 and only 404s on the
 * second hop, which is the soft-404 shape the Search Readiness audit reports
 * (2026-10-25: `/sr-check-...-nope/` → 308, not 404) and the reason a broken link
 * pointed at this site can look alive to whoever is checking. An unknown first
 * segment is now rewritten to the same path without the slash, so Next renders its
 * own 404 page with a 404 status at the URL that was asked for. `next.config.ts`
 * sets skipTrailingSlashRedirect so this runs at all.
 */
function trailingSlash(request: NextRequest, pathname: string) {
  if (pathname === '/' || !pathname.endsWith('/')) return null;
  const stripped = pathname.replace(/\/+$/, '') || '/';
  // A plain URL, not request.nextUrl.clone(): with skipTrailingSlashRedirect set,
  // NextURL remembers that the incoming path ended in a slash and puts it back when
  // the URL is serialised, so assigning the stripped pathname to a clone produced
  // `location: /about/` on a request for /about/ - a redirect to itself. Proved
  // against `next start` on 2026-10-25 before this line changed.
  const url = new URL(request.url);
  url.pathname = stripped;
  const segment = stripped.split('/')[1] ?? '';
  if (ROUTE_SEGMENTS.includes(segment)) return NextResponse.redirect(url, 308);
  return NextResponse.rewrite(url);
}

export function middleware(request: NextRequest) {
  const rawHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  const originalHost = rawHost.split(',')[0].trim().toLowerCase().split(':')[0];
  const host = apexHost(originalHost);
  const pathname = request.nextUrl.pathname;

  if (isPreviewHost(originalHost)) return withPathname(request);

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

  // Plain http must never render. Cloudflare's "Always Use HTTPS" is off for these
  // zones, so until 2026-09-25 http://<host>/<path> answered 200 with the same
  // title and description as the https page, and Bing reported
  // weddingseatingchartmaker.com/products/seating-chart-maker twice under rules
  // 113 and 117 (duplicate title, duplicate description) - one URL per scheme.
  // The scheme is read from what Cloudflare tells the Worker the visitor used
  // (cf-visitor, else x-forwarded-proto on a request that carries cf-ray), never
  // from nextUrl.protocol alone, because `next start` behind the link-graph and
  // SEO crawlers is plain http on 127.0.0.1 and must keep rendering there.
  if ((isCanonicalHost(host) || originalHost.startsWith('www.')) && visitorScheme(request) === 'http') {
    const url = request.nextUrl.clone();
    url.protocol = 'https:';
    url.host = isCanonicalHost(host) ? host : originalHost;
    url.port = '';
    return NextResponse.redirect(url, 301);
  }

  if (originalHost.startsWith('www.') && isCanonicalHost(host)) {
    const url = request.nextUrl.clone();
    url.protocol = 'https:';
    url.host = host;
    return NextResponse.redirect(url, 308);
  }

  if (!isCanonicalHost(host)) return withPathname(request);
  if (passthroughPrefixes.some((prefix) => pathname.startsWith(prefix)) || passthroughExact.includes(pathname)) return NextResponse.next();
  // After the passthroughs: the framework files and verification files carry no
  // trailing slash, and they must never be rewritten.
  const slashed = trailingSlash(request, pathname);
  if (slashed) return slashed;
  if (pathname === '/' && hostConfig[host].root_action === 'redirect') {
    const url = request.nextUrl.clone();
    url.pathname = hostConfig[host].root_target;
    return NextResponse.redirect(url, 308);
  }
  if (pathname === '/guides' || pathname === '/editorial-policy' || pathname === '/sitemap.xml' || pathname === '/robots.txt' || pathname === '/llms.txt') return withPathname(request);

  const owner = canonicalHostForPath(pathname);
  if (owner && owner !== host) {
    const url = request.nextUrl.clone();
    url.protocol = 'https:';
    url.host = owner;
    return NextResponse.redirect(url, 308);
  }

  return withPathname(request);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)']
};
