#!/usr/bin/env node
'use strict';
// Enforce the blocks the external review agent keeps asking for.
//
// Across ~2,750 recommendations audited on two sibling sites, the agent asks for
// the same small set of things over and over. 27% of distinct defects were
// re-reported on later runs despite being marked released - the same page
// missing the same block, found again. This checks for those blocks before
// publish instead of after audit.
//
// Derived from the recommendations themselves (.clarity/content-pattern-spec.json):
//
//   1 checklist / numbered protocol      730 occurrences (36.4%)
//   2 comparison / decision / cost table 529 (26.4%)
//   3 direct-answer block                512 (25.5%)
//   5 concrete numbers                   365 (18.2%)
//   6 named primary sources              288 (14.3%)
//   7 query present in a heading         261 (13.0%)
//   9 FAQ block                          136 (6.8%)
//  10 structured data                     70 (3.5%)
//
// Adapted surface. This repo does not ship static HTML; every public content
// page is a record rendered through one of three templates, so the contract is
// checked against the records that decide what the page contains:
//
//   hub     data/seo/hub_pages.json              -> components/seo/HubPage.tsx
//   guide   data/authority/content_registry.json -> app/guides/[slug]/page.tsx
//   product data/products/product_catalog.json   -> app/products/[slug]/page.tsx
//
// Guides are filtered the same way the route filters them: authority:scale:fanout
// appends candidate skeletons to the registry and only complete pages are built,
// so only shipping pages are measured. app/ routes that are application surfaces
// (builder, dashboard, admin, checkout, legal) are not content pages and are not
// measured - holding a login screen to a direct-answer contract measures nothing.
//
// Severity is split. The blocks that decide whether a page can be quoted at all
// block the release; the rest report as gaps so they can be worked without
// stopping a release.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const EVIDENCE = path.join(ROOT, 'artifacts/validation/content-pattern-contract.json');
const ENFORCEMENT = 'block'; // 'block' | 'report'

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const hubs = readJson('data/seo/hub_pages.json').pages;
const registry = readJson('data/authority/content_registry.json');
const catalog = readJson('data/products/product_catalog.json');

const productRoutes = new Map(catalog.products.map((p) => [p.id, p.route]));

// Explicit, reasoned exceptions. Each entry says why the page cannot satisfy the
// check, so the list stays auditable instead of becoming a place to hide gaps.
const EXCEPTIONS = new Map([
  ['/printable-wedding-checklist', {
    check: 'no_empty_table_cells',
    reason: 'The table is a printable fill-in form. Task is populated; Owner, Due date '
      + 'and Done are deliberately blank because the reader writes them in, and HubPage '
      + 'renders each as a spacer so the published markup ships no empty <td>. Filling '
      + "them would invent a plan for someone else's wedding.",
  }],
  ['/wedding-seating-chart', {
    check: 'no_empty_table_cells',
    reason: 'One sample guest row leaves Allergy/accessibility blank, which is the '
      + 'meaningful value for that guest: nothing recorded. Same rendering guarantee as '
      + 'above. Writing a placeholder allergy into an example seating chart would be '
      + 'fabricating content.',
  }],
]);

// The operations-suite bundle is a SKU, not a content page: it has no headline
// or promise because it is rendered by app/shop/page.tsx and the bespoke
// app/products/operations-suite/page.tsx, not by the [slug] content template.
const CONTENT_PRODUCTS = catalog.products.filter((p) => p.id !== 'operations-suite');

// Same completeness filter as app/guides/[slug]/page.tsx: only pages that
// actually build are measured.
const shippingGuides = registry.pages.filter((p) => Array.isArray(p.sections) && Array.isArray(p.faqs)
  && Array.isArray(p.related_slugs) && Array.isArray(p.examples) && Boolean(p.hub_route));

const flat = (value) => {
  if (value == null) return '';
  if (typeof value === 'string') return ` ${value}`;
  if (Array.isArray(value)) return value.map(flat).join(' ');
  if (typeof value === 'object') return Object.values(value).map(flat).join(' ');
  return ` ${value}`;
};

const pages = [];
for (const [slug, hub] of Object.entries(hubs)) {
  pages.push({ kind: 'hub', rel: `/${slug}`, record: hub, text: flat(hub) });
}
for (const guide of shippingGuides) {
  pages.push({ kind: 'guide', rel: `/guides/${guide.slug}`, record: guide, text: flat(guide) });
}
for (const product of CONTENT_PRODUCTS) {
  pages.push({ kind: 'product', rel: product.route, record: product, text: flat(product) });
}
pages.sort((a, b) => a.rel.localeCompare(b.rel));

// Both content templates render <JsonLd> unconditionally, so structured data is
// a template guarantee rather than a per-record field. Read it off the template
// instead of asserting it.
const templateEmitsJsonLd = (file) => /<JsonLd\b/.test(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const JSONLD = {
  hub: templateEmitsJsonLd('components/seo/HubPage.tsx'),
  guide: templateEmitsJsonLd('app/guides/[slug]/page.tsx'),
  product: templateEmitsJsonLd('app/products/[slug]/page.tsx'),
};

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const heading = (p) => (p.kind === 'hub' ? str(p.record.h1)
  : p.kind === 'guide' ? str(p.record.title) : str(p.record.headline));
const answer = (p) => (p.kind === 'hub' ? str(p.record.direct_answer)
  : p.kind === 'guide' ? str(p.record.answer) : str(p.record.promise));
const table = (p) => (p.kind === 'hub' ? p.record.table : null);

const CHECKS = [
  { id: 'direct_answer', blocking: true,
    // Long enough to stand on its own when an answer engine lifts it out of the
    // page. A one-line label is not an answer.
    test: (p) => answer(p).length > 40,
    why: 'no direct-answer block - nothing here is quotable without surrounding context' },
  { id: 'query_in_heading', blocking: true,
    test: (p) => heading(p).length > 10,
    why: 'h1 missing or too short to carry the searcher phrasing' },
  { id: 'no_empty_table_cells', blocking: true,
    // A hub's table is data, not markup: an empty source cell is an empty cell
    // to the reader whatever the template substitutes for it.
    test: (p) => {
      const t = table(p);
      if (!t) return true;
      if (!Array.isArray(t.headers) || t.headers.some((h) => !str(h))) return false;
      return (t.rows || []).every((row) => row.every((cell) => str(cell).length > 0));
    },
    why: 'table ships empty cells - the agent calls these impossible to cite' },
  { id: 'conversion_path', blocking: true,
    // The repo's real conversion destination is the paid product landing page
    // (data/authority/authority_destination_policy.json primary_destinations),
    // not the free builder and not a content hub.
    test: (p) => (p.kind === 'product'
      ? Boolean(str(p.record.route)) && /\$\s?\d/.test(str(p.record.cta))
      : productRoutes.has(p.record.product_id)),
    why: 'no conversion path - an answer-engine citation lands with nowhere to go' },
  { id: 'checklist', blocking: false,
    test: (p) => (p.kind === 'hub' ? (p.record.sections || []).some((s) => (s.bullets || []).length > 0)
      : p.kind === 'guide' ? (p.record.steps || []).length > 0
        : (p.record.process || []).length > 0),
    why: 'no checklist or numbered protocol (agent request #1, 730 occurrences)' },
  { id: 'comparison_table', blocking: false,
    test: (p) => {
      const t = table(p);
      return Boolean(t && (t.headers || []).length && (t.rows || []).length);
    },
    why: 'no comparison or cost table (agent request #2, 529 occurrences)' },
  { id: 'concrete_numbers', blocking: false,
    test: (p) => /\$\s?\d|\d+\s?(?:days?|weeks?|months?|years?|hours?|minutes?)\b/i.test(p.text),
    why: 'no concrete cost or timeline figures (agent request #5, 365 occurrences)' },
  { id: 'named_sources', blocking: false,
    test: (p) => /https?:\/\/(?!(?:www\.)?(?:weddingchecklistpdf|weddingseatingchartmaker|weddingbudgetspreadsheet|weddingtimelinetemplate)\.com)/i.test(p.text)
      || /\bSources?:|\bAccording to the\b|\bpublished by\b/i.test(p.text),
    why: 'no named primary source (agent request #6, 288 occurrences)' },
  { id: 'faq', blocking: false,
    test: (p) => (p.kind === 'product' ? (p.record.objections || []).length > 0 : (p.record.faqs || []).length > 0),
    why: 'no FAQ block or FAQPage schema (agent request #9)' },
  { id: 'structured_data', blocking: false,
    test: (p) => Boolean(JSONLD[p.kind]),
    why: 'no JSON-LD structured data (agent request #10)' },
];

const blockingFailures = [];
const exempted = [];
const gaps = {};
for (const check of CHECKS) gaps[check.id] = [];

for (const page of pages) {
  for (const check of CHECKS) {
    if (check.test(page)) continue;
    const exception = EXCEPTIONS.get(page.rel);
    if (exception && exception.check === check.id) {
      exempted.push({ path: page.rel, check: check.id, reason: exception.reason });
      continue;
    }
    if (check.blocking) blockingFailures.push({ path: page.rel, kind: page.kind, check: check.id, why: check.why });
    else gaps[check.id].push(page.rel);
  }
}

const summary = CHECKS.map((check) => {
  const missing = check.blocking
    ? blockingFailures.filter((f) => f.check === check.id).length
    : gaps[check.id].length;
  return {
    id: check.id,
    blocking: check.blocking,
    pages_missing: missing,
    coverage_pct: Number((100 * (1 - missing / Math.max(pages.length, 1))).toFixed(1)),
    why: check.why,
  };
});

fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
fs.writeFileSync(EVIDENCE, `${JSON.stringify({
  schema_version: '1.0',
  validator: 'content-pattern-contract',
  spec: '.clarity/content-pattern-spec.json',
  generated_at: new Date().toISOString(),
  enforcement: ENFORCEMENT,
  pages_checked: pages.length,
  pages_by_kind: pages.reduce((acc, p) => ({ ...acc, [p.kind]: (acc[p.kind] || 0) + 1 }), {}),
  status: blockingFailures.length ? (ENFORCEMENT === 'block' ? 'FAIL' : 'REPORTED') : 'PASS',
  blocking_failures: blockingFailures.length,
  exempted,
  summary,
  worst_gaps: Object.fromEntries(Object.entries(gaps).map(([k, v]) => [k, v.slice(0, 25)])),
  blocking_backlog: blockingFailures.slice(0, 200),
}, null, 2)}\n`);

console.log(`content-pattern-contract: ${pages.length} content pages checked (enforcement: ${ENFORCEMENT})`);
for (const s of summary) {
  const tag = s.blocking ? 'BLOCKING' : 'gap     ';
  console.log(`  ${tag} ${s.id.padEnd(22)} coverage ${String(s.coverage_pct).padStart(5)}%  missing on ${s.pages_missing}`);
}
if (blockingFailures.length) {
  const log = ENFORCEMENT === 'block' ? console.error : console.warn;
  log(`content-pattern-contract: ${blockingFailures.length} blocking gap(s)`);
  for (const f of blockingFailures.slice(0, 15)) log(`  ${f.path} :: ${f.why}`);
  if (blockingFailures.length > 15) log(`  ...and ${blockingFailures.length - 15} more`);
  if (ENFORCEMENT === 'block') process.exit(1);
  console.warn('  reported, not blocking, while the backlog above is worked.');
  process.exit(0);
}
if (exempted.length) {
  console.log(`\n  ${exempted.length} documented exception(s):`);
  for (const e of exempted) console.log(`    ${e.path} :: ${e.check}`);
}
console.log('content-pattern-contract passed');
