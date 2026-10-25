/**
 * The request header middleware.ts attaches so app/layout.tsx knows which page it
 * is wrapping. A server layout has no other way to read the pathname, and the
 * structured-data frame it emits (lib/page-frame.ts) is per page.
 *
 * It lives in its own module so neither side has to import the other: pulling
 * middleware.ts into a page would drag the edge runtime into the page bundle, and
 * pulling lib/page-frame.ts into middleware.ts would drag the whole content
 * registry into the middleware bundle.
 */
export const PATHNAME_HEADER = 'x-dwb-pathname';
