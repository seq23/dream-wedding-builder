import registry from '@/data/authority/content_registry.json';

export type RegistryPage = (typeof registry.pages)[number];

// authority:scale:fanout appends candidate pages to the registry on every run of
// .github/workflows/full-safe-autonomy.yml, and admission holds back the ones it
// has not finished. app/guides/[slug]/page.tsx dereferences sections, faqs,
// related_slugs, examples and hub_route unconditionally, so a page missing any of
// them cannot render and the route notFound()s it.
//
// This predicate is therefore the single definition of "this slug serves 200".
// It lives here, and not next to the route, because app/sitemap.xml/route.ts must
// publish exactly the set the route agrees to render. When the two carried their
// own copies the sitemap advertised URLs the router refused, and every fan-out run
// widened the gap. One function, imported by both, cannot drift.
export const isComplete = (page: RegistryPage): boolean =>
  Array.isArray((page as { sections?: unknown[] }).sections) &&
  Array.isArray((page as { faqs?: unknown[] }).faqs) &&
  Array.isArray((page as { related_slugs?: unknown[] }).related_slugs) &&
  Array.isArray((page as { examples?: unknown[] }).examples) &&
  Boolean((page as { hub_route?: string }).hub_route);

/** Every registry page that app/guides/[slug]/page.tsx will actually render. */
export const shippingPages = registry.pages.filter(isComplete);

const shippingSlugs = new Set(shippingPages.map((page) => page.slug));

/** True when /guides/<slug> serves 200 rather than 404. */
export const isShippingSlug = (slug: string): boolean => shippingSlugs.has(slug);

/**
 * True when a site-relative path is safe to advertise. Non-guide paths are owned
 * by route_ownership.json and are not gated here; guide paths are gated on the
 * renderable set.
 */
export function isPublishablePath(path: string): boolean {
  const guide = path.match(/^\/guides\/([^/]+)\/?$/);
  return guide ? isShippingSlug(guide[1]) : true;
}
