import registry from '@/data/authority/content_registry.json';

import { isComplete } from '@/lib/authority-complete.mjs';

export type RegistryPage = (typeof registry.pages)[number];

// authority:scale:fanout appends candidate pages to the registry on every run of
// .github/workflows/full-safe-autonomy.yml, and admission holds back the ones it
// has not finished. app/guides/[slug]/page.tsx dereferences sections, faqs,
// related_slugs, examples and hub_route unconditionally, so a page missing any of
// them cannot render and the route notFound()s it.
//
// The predicate that decides that is defined once, in lib/authority-complete.mjs,
// and re-exported here so the route, the sitemap, the build scripts, the validator
// and scripts/authority_scale/publish_authority_batch.mjs all call the same
// function object. It is plain ESM rather than TypeScript only because the Node
// scripts have to import it too; nothing about its meaning lives outside that file.
export { isComplete };

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
