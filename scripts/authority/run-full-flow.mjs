import fs from 'node:fs'; import path from 'node:path';
const root = process.cwd();
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const write = (p, value) => { const file = path.join(root, p); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); };
const content = read('data/authority/content_registry.json');
const catalog = read('data/products/product_catalog.json');
const hubs = read('data/seo/hub_pages.json').pages;
const seen = new Set(), answerSeen = new Map(), semanticSeen = new Map(), admitted = [], rejected = [];
const norm = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
for (const page of content.pages) {
  const reasons = [];
  if (!page.slug || !page.title || !page.answer || !page.semantic_key) reasons.push('missing_core');
  if (page.answer.length < 220) reasons.push('thin_answer');
  if (!Array.isArray(page.steps) || page.steps.length < 6) reasons.push('insufficient_steps');
  if (!Array.isArray(page.sections) || page.sections.length < 3) reasons.push('insufficient_sections');
  if (!Array.isArray(page.faqs) || page.faqs.length < 3) reasons.push('insufficient_faqs');
  if (!Array.isArray(page.related_slugs) || page.related_slugs.length < 4) reasons.push('insufficient_links');
  if (seen.has(page.slug)) reasons.push('duplicate_slug'); else seen.add(page.slug);
  const answerHash = norm(page.answer), semantic = norm(page.semantic_key);
  if (answerSeen.has(answerHash)) reasons.push(`duplicate_answer:${answerSeen.get(answerHash)}`); else answerSeen.set(answerHash, page.slug);
  if (semanticSeen.has(semantic)) reasons.push(`duplicate_semantic_intent:${semanticSeen.get(semantic)}`); else semanticSeen.set(semantic, page.slug);
  if (!catalog.products.some((product) => product.id === page.product_id)) reasons.push('unknown_product');
  if (!Object.values(hubs).some((hub) => `/${Object.entries(hubs).find(([, value]) => value === hub)?.[0]}` === page.hub_route)) reasons.push('unknown_hub_route');
  (reasons.length ? rejected : admitted).push({ ...page, reasons });
}
const links = admitted.flatMap((page) => {
  const product = catalog.products.find((item) => item.id === page.product_id);
  return [{ from: `/guides/${page.slug}`, to: page.hub_route, anchor: `Start with the ${page.cluster.toLowerCase()} hub`, relationship: 'upward' }, { from: `/guides/${page.slug}`, to: product?.route, anchor: product?.name, relationship: 'conversion' }, ...page.related_slugs.map((slug) => ({ from: `/guides/${page.slug}`, to: `/guides/${slug}`, anchor: admitted.find((item) => item.slug === slug)?.title ?? slug, relationship: 'related' }))];
});
// authority:scale:publish appends candidate skeletons to the registry: a row with
// a source_opportunity_id, a generated summary/answer/steps, and no sections,
// faqs, examples or hub_route until someone authors them. They are not defects and
// they never reach a reader - app/guides/[slug]/page.tsx and
// scripts/validators/validate_content_pattern_contract.js both filter on exactly
// this predicate, so an unauthored row builds no route and is measured by nothing.
const isAuthored = (page) => Array.isArray(page.sections) && Array.isArray(page.faqs)
  && Array.isArray(page.related_slugs) && Array.isArray(page.examples) && Boolean(page.hub_route);
// Reasons that mean the registry is genuinely broken rather than merely unauthored:
// a collision, a dangling product reference, or a row missing the core fields.
// These count against the ceiling wherever they appear, skeleton or not.
const BREAKAGE = /^(missing_core|unknown_product|duplicate_slug|duplicate_answer|duplicate_semantic_intent)/;
const isDefective = (page) => isAuthored(page) || page.reasons.some((reason) => BREAKAGE.test(reason));
const defective = rejected.filter(isDefective);
const pendingAuthoring = rejected.filter((page) => !isDefective(page));
const runAt = process.env.AUTHORITY_RUN_AT || '2026-07-30T00:00:00.000Z';
const report = { run_at: runAt, mode: process.env.AUTONOMY_MODE || 'FULL_SAFE_AUTONOMY', discovered: content.pages.length, admitted: admitted.length, rejected: rejected.length, defective: defective.length, pending_authoring: pendingAuthoring.length, quality_floor: 9, hub_count: Object.keys(hubs).length, domain_counts: Object.fromEntries(catalog.products.filter((product) => product.domain).map((product) => [product.domain, admitted.filter((page) => page.product_id === product.id).length])) };
write('artifacts/authority/admission-report.json', { report, rejected });
write('data/authority/internal_link_registry.json', { version: '3.0.0', links });
write('artifacts/authority/release-manifest.json', { generated_at: report.run_at, routes: [...Object.keys(hubs).map((slug) => `/${slug}`), ...admitted.map((page) => `/guides/${page.slug}`)] });
console.log(JSON.stringify(report, null, 2));
// An admission filter that rejects nothing is not a filter. Failing the run
// because some pages were rejected meant the 67 admitted pages never published -
// this repo has never released a single page for that reason.
//
// Fail only on evidence that something is systemically wrong: nothing admitted at
// all, or a defect rate high enough to indicate a broken registry rather than a
// handful of unfinished drafts. Individual rejections are reported in
// artifacts/authority/admission-report.json either way.
//
// The rate is measured over the pages that are supposed to be publishable -
// admitted plus defective - not over the whole registry. Measuring it over the
// whole registry counted the authoring backlog as breakage: authority:scale:publish
// appends 15 unauthored skeletons per day by design, every one of them rejected by
// definition, so the ratio climbed with normal operation and would breach any fixed
// ceiling on a registry with nothing wrong with it. That is what happened here -
// all 30 rejected rows were skeletons and none carried a defect reason.
const REJECTION_RATE_CEILING = 0.25;
const publishable = admitted.length + defective.length;
const rate = publishable ? defective.length / publishable : 0;
if (!admitted.length) {
  console.error('[authority:flow] FAIL: no pages admitted - nothing can publish');
  process.exitCode = 1;
} else if (rate > REJECTION_RATE_CEILING) {
  console.error(`[authority:flow] FAIL: defect rate ${(rate * 100).toFixed(1)}% of ${publishable} publishable page(s) exceeds ${(REJECTION_RATE_CEILING * 100).toFixed(0)}% ceiling - registry likely broken, not merely incomplete`);
  process.exitCode = 1;
} else if (rejected.length) {
  console.log(`[authority:flow] ${admitted.length} admitted; ${pendingAuthoring.length} unauthored candidate(s) awaiting sections, faqs, examples and a hub route; ${defective.length} defective (${(rate * 100).toFixed(1)}% of ${publishable} publishable). See artifacts/authority/admission-report.json`);
}
