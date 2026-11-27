// The single definition of "this registry entry serves 200".
//
// app/guides/[slug]/page.tsx dereferences sections, faqs, related_slugs, examples
// and hub_route unconditionally, so an entry missing any of them cannot render and
// the route notFound()s it. Four consumers have to agree on that fact and they do
// not share a loader: the app (bundled TypeScript), Node build scripts, the
// registry validator, and the generator that writes new entries. So the predicate
// lives here, in plain ESM that every one of them can import, and
// lib/authority-registry.ts re-exports it unchanged for the app side.
//
// It is deliberately not reimplemented anywhere. When the router and the sitemap
// each carried their own copy, the sitemap advertised URLs the router refused and
// every fan-out run widened the gap; when the generator carried no copy at all it
// wrote 45 entries in 28 days that no route would serve. One function, imported
// by all of them, cannot drift.

/** Fields app/guides/[slug]/page.tsx iterates. Each must be an array. */
export const REQUIRED_ARRAY_FIELDS = Object.freeze(['sections', 'faqs', 'related_slugs', 'examples']);

/** Fields the page links from. Each must be a non-empty string. */
export const REQUIRED_STRING_FIELDS = Object.freeze(['hub_route']);

/**
 * The five things every guide must carry before it publishes, as the About and editorial
 * policy pages promise: the direct answer, the working method, a worked example, the
 * mistake couples make, and the point where the reader has to check something. Each must
 * be present AND non-empty; the template renders every one of them (promise audit,
 * 27 Nov 2026: this check used to test only that `examples` was an array).
 */
const nonEmptyText = (value) => typeof value === 'string' && value.trim().length > 0;
const nonEmptyList = (value) => Array.isArray(value) && value.some((item) => (typeof item === 'string' ? item.trim() : item));
export const FIVE_THINGS = Object.freeze({
  answer: (page) => nonEmptyText(page?.answer),
  steps: (page) => nonEmptyList(page?.steps),
  worked_example: (page) => Array.isArray(page?.examples) && page.examples.some((example) => example?.title !== 'Control check' && nonEmptyText(example?.body)),
  mistakes: (page) => nonEmptyList(page?.mistakes),
  verification_boundary: (page) => nonEmptyText(page?.verification_boundary),
});

/** True when /guides/<page.slug> serves 200 rather than 404. */
export const isComplete = (page) =>
  REQUIRED_ARRAY_FIELDS.every((field) => Array.isArray(page?.[field])) &&
  REQUIRED_STRING_FIELDS.every((field) => Boolean(page?.[field])) &&
  Object.values(FIVE_THINGS).every((has) => has(page));

/** The required fields this entry is missing, in registry order. Empty when isComplete(). */
export const missingRequiredFields = (page) => [
  ...REQUIRED_ARRAY_FIELDS.filter((field) => !Array.isArray(page?.[field])),
  ...REQUIRED_STRING_FIELDS.filter((field) => !page?.[field]),
  ...Object.entries(FIVE_THINGS).filter(([, has]) => !has(page)).map(([field]) => field),
];

// A template variable that survived expansion. Every one of the 45 retired entries
// carried a literal {topic} in semantic_key because the intent pattern was copied
// through unexpanded. That is a generator bug reaching a data file, so it is a
// failure wherever it is found - never a warning.
export const PLACEHOLDER_PATTERN = /\{[A-Za-z0-9_]+\}/;

/**
 * Every string anywhere in `value` that still contains an unexpanded {placeholder},
 * as [{ path, value }] with a dotted/indexed path from the root of what was passed.
 */
export function findPlaceholders(value, path = '') {
  if (typeof value === 'string') {
    return PLACEHOLDER_PATTERN.test(value) ? [{ path: path || '.', value }] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => findPlaceholders(item, `${path}[${i}]`));
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).flatMap((key) => findPlaceholders(value[key], `${path}.${key}`));
  }
  return [];
}
