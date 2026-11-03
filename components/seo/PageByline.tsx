import Link from 'next/link';
import { lastmodFor } from '@/lib/lastmod';
import { canonicalUrl, isCanonicalHost, PARENT_HOST, type SiteHost } from '@/lib/site-config';
import { siteOrganizationId } from '@/lib/site-home';

/**
 * The visible byline, and the matching JSON-LD author, for the pages built from
 * plain JSX rather than from a page-shape record: the guides index and the product
 * pages.
 *
 * Why it exists: Search Readiness item c6 asks for a named author or reviewer that
 * a reader can actually see, and it is satisfied only when a name in the page's
 * JSON-LD `author` also appears in the page's visible text. The guides index
 * carried no byline at all, and the product pages carried the words "By Dream
 * Wedding Builder" with no `author` in their structured data, so the name on the
 * page and the name in the markup were never the same claim. Both sites' weekly
 * samples failed c6 on 3 November 2026 for exactly that reason.
 *
 * The author is the publisher, stated once as an entity reference plus its name:
 * the Organization record itself lives in lib/site-home.ts and is never restated
 * here, because a second {name, url} stub is a second entity to an engine.
 * The date is read from the lastmod ledger and omitted when the ledger has no
 * record, never replaced by a constant - the same rule lib/lastmod.ts states.
 */
export const PUBLISHER_NAME = 'Dream Wedding Builder';

/** A route's own host, falling back to the parent site for anything off the four canonical domains. */
const resolveHost = (host: string): SiteHost => (isCanonicalHost(host) ? host : PARENT_HOST);
const ABOUT_URL = 'https://weddingchecklistpdf.com/about';

/** Spreads into a JSON-LD node: the author, and the real change date when known. */
export function bylineAuthorFields(host: string, path: string) {
  const site = resolveHost(host);
  const updated = lastmodFor(path);
  return {
    author: { '@type': 'Organization', '@id': siteOrganizationId(site), name: PUBLISHER_NAME, url: ABOUT_URL },
    ...(updated ? { dateModified: updated } : {})
  };
}

/**
 * A WebPage node for this path carrying the author. It reuses the @id the frame in
 * app/layout.tsx already emits for the same URL, so the two describe one thing and
 * merge rather than contradict (lib/site-home.ts, webPageNode).
 */
export function bylineWebPageNode(host: string, path: string) {
  const pageUrl = canonicalUrl(resolveHost(host), path);
  return { '@context': 'https://schema.org', '@type': 'WebPage', '@id': `${pageUrl}#webpage`, url: pageUrl, ...bylineAuthorFields(host, path) };
}

/** The byline a reader sees. The name here is the name in bylineAuthorFields. */
export function PageByline({ path }: { path: string }) {
  const updated = lastmodFor(path);
  return <p className="text-sm leading-6 text-charcoal/60">
    By <Link href={ABOUT_URL} rel="author" className="font-semibold underline decoration-charcoal/20 underline-offset-4">{PUBLISHER_NAME}</Link>
    {' '}· Publisher: Dream Wedding Builder, a Spry Labs company.
    {updated ? <> · Updated <time dateTime={updated}>{updated}</time></> : null}
  </p>;
}
