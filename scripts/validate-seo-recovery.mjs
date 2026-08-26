import fs from 'node:fs';
import crypto from 'node:crypto';

const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const errors = [];
const ownership = read('data/seo/route_ownership.json');
const hubs = read('data/seo/hub_pages.json').pages;
const registry = read('data/authority/content_registry.json');
const previewManifest = read('data/products/product_preview_manifest.json');
const catalog = read('data/products/product_catalog.json');
const products = catalog.products.filter((product) => product.domain);
const links = read('data/authority/internal_link_registry.json').links;

const norm = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const tokens = (value) => new Set(norm(value).split(' ').filter((token) => token.length > 2));
const jaccard = (a, b) => {
  const A = tokens(a), B = tokens(b);
  const intersection = [...A].filter((token) => B.has(token)).length;
  const union = new Set([...A, ...B]).size;
  return union ? intersection / union : 0;
};
const pageText = (page) => [page.answer, ...(page.sections ?? []).flatMap((section) => [section.heading, ...(section.paragraphs ?? []), ...(section.bullets ?? [])]), ...(page.examples ?? []).map((item) => item.body), ...(page.faqs ?? []).map((item) => `${item.question} ${item.answer}`)].join(' ');

if (ownership.parent_host !== 'weddingchecklistpdf.com') errors.push('wrong parent host');
if (Object.keys(ownership.hosts).length !== 4) errors.push('expected four canonical hosts');
if (Object.keys(hubs).length !== 8) errors.push(`expected 8 hub/product-preview pages, found ${Object.keys(hubs).length}`);
if (products.length !== 4) errors.push(`expected 4 domain-owned products, found ${products.length}`);

const routeKeys = new Set();
for (const route of ownership.routes) {
  const key = `${route.host}${route.path}`;
  if (routeKeys.has(key)) errors.push(`duplicate route ownership: ${key}`);
  routeKeys.add(key);
  if (!ownership.hosts[route.host]) errors.push(`unknown route host: ${route.host}`);
}
for (const [slug, page] of Object.entries(hubs)) {
  if (!fs.existsSync(`app/${slug}/page.tsx`)) errors.push(`missing hub route file: ${slug}`);
  if (!ownership.routes.some((route) => route.path === `/${slug}` && route.host === page.host && route.indexable)) errors.push(`missing hub ownership: ${slug}`);
  if (!page.title || !page.description || !page.h1 || !page.direct_answer) errors.push(`incomplete hub core: ${slug}`);
  if (!Array.isArray(page.sections) || page.sections.length < 3) errors.push(`hub sections too thin: ${slug}`);
  if (!Array.isArray(page.faqs) || page.faqs.length < 3) errors.push(`hub FAQs too thin: ${slug}`);
  if (!Array.isArray(page.related) || page.related.length < 4) errors.push(`hub internal links too thin: ${slug}`);
  if ('asset' in page) errors.push(`legacy public download asset remains on hub: ${slug}`);
}

// authority:scale:fanout appends candidate pages to the registry on every run and
// admission holds back the incomplete ones. Validating the raw registry therefore
// judged pages that were never going to ship. Validate the admitted set instead;
// rejected candidates stay in the registry and in the admission report, they are
// simply not held to the standard of published pages.
let rejectedSlugs = new Set();
try {
  const admission = JSON.parse(fs.readFileSync('artifacts/authority/admission-report.json', 'utf8'));
  rejectedSlugs = new Set((admission.rejected || []).map((p) => p.slug).filter(Boolean));
} catch (err) {
  // Loud on purpose: silently validating everything would hide the fanout
  // candidates this filter exists to exclude.
  console.warn(`[validate-seo-recovery] no admission report (${err.code || err.name}); validating the full registry`);
}
const shippingPages = registry.pages.filter((p) => !rejectedSlugs.has(p.slug));

// A floor, not an exact count. This asserted exactly 67 guides forever, so the
// publishing lane could never add a page without failing validation - in a repo
// whose entire purpose is publishing pages. The property worth protecting is that
// guides are never silently lost, which a floor gives us.
const MINIMUM_SHIPPING_GUIDES = 67;
if (shippingPages.length < MINIMUM_SHIPPING_GUIDES) errors.push(`guide count regressed below floor: expected at least ${MINIMUM_SHIPPING_GUIDES}, found ${shippingPages.length}`);

const slugSeen = new Set(), titleSeen = new Set(), semanticSeen = new Set();
for (const page of shippingPages) {
  if (slugSeen.has(page.slug)) errors.push(`duplicate slug: ${page.slug}`); else slugSeen.add(page.slug);
  if (titleSeen.has(norm(page.title))) errors.push(`duplicate title: ${page.title}`); else titleSeen.add(norm(page.title));
  if (semanticSeen.has(page.semantic_key)) errors.push(`duplicate semantic key: ${page.semantic_key}`); else semanticSeen.add(page.semantic_key);
  if (page.answer.length < 220) errors.push(`thin answer: ${page.slug}`);
  if (!Array.isArray(page.steps) || page.steps.length < 6) errors.push(`insufficient steps: ${page.slug}`);
  if (!Array.isArray(page.sections) || page.sections.length < 3) errors.push(`insufficient sections: ${page.slug}`);
  if (!Array.isArray(page.examples) || page.examples.length < 2) errors.push(`insufficient examples: ${page.slug}`);
  if (!Array.isArray(page.faqs) || page.faqs.length < 3) errors.push(`insufficient FAQs: ${page.slug}`);
  if (!Array.isArray(page.related_slugs) || page.related_slugs.length < 4) errors.push(`insufficient related guides: ${page.slug}`);
  if (!page.hub_route || !Object.keys(hubs).some((slug) => `/${slug}` === page.hub_route)) errors.push(`invalid hub route: ${page.slug}`);
  if (!ownership.routes.some((route) => route.path === `/guides/${page.slug}` && route.indexable)) errors.push(`missing guide ownership: ${page.slug}`);
  const titleOnly = norm(page.title);
  if (norm(page.answer) === titleOnly || tokens(page.answer).size < 28) errors.push(`title-substitution/thin answer risk: ${page.slug}`);
  const sentences = pageText(page).split(/[.!?]+/).map(norm).filter((sentence) => sentence.split(' ').length >= 7);
  const uniqueSentences = new Set(sentences);
  if (sentences.length && uniqueSentences.size / sentences.length < 0.62) errors.push(`boilerplate ratio too high: ${page.slug}`);
}

// Every other check above moved to shippingPages when the admission filter was
// added; this pair scan was left on the raw registry, so it went on holding
// unauthored candidates to a published-page standard. It compares pageText, which
// for a shipping guide includes its sections and faqs and for an unauthored
// candidate is only the generated summary, answer, steps and mistakes - two
// candidates on the same topic therefore look near-identical until the authoring
// that differentiates them exists. Judge published prose on published prose.
// Candidates are not unguarded: scripts/authority_scale/validate_authority_scale.mjs
// scans the generated population for near-duplicates, and
// scripts/authority_scale/publish_authority_batch.mjs applies the same measure
// before a candidate is ever written.
for (let i = 0; i < shippingPages.length; i++) {
  for (let j = i + 1; j < shippingPages.length; j++) {
    const a = shippingPages[i], b = shippingPages[j];
    const similarity = jaccard(pageText(a), pageText(b));
    if (similarity > 0.78) errors.push(`near-duplicate guides: ${a.slug} <> ${b.slug} (${similarity.toFixed(2)})`);
  }
}
for (const page of shippingPages) {
  // Guarded: an unguarded iterate here crashed the whole validator with a
  // TypeError before any collected error could be printed, so a data problem
  // surfaced as a stack trace instead of an actionable message.
  for (const related of (Array.isArray(page.related_slugs) ? page.related_slugs : [])) if (!slugSeen.has(related)) errors.push(`missing related guide ${related} from ${page.slug}`);
  if (!links.some((link) => link.from === `/guides/${page.slug}` && link.to === page.hub_route)) errors.push(`missing upward link registry: ${page.slug}`);
}

if (previewManifest.products.length !== 4) errors.push(`expected preview manifest for 4 products, found ${previewManifest.products.length}`);
const previewHashes = new Set();
let previewCount = 0;
for (const manifestProduct of previewManifest.products) {
  const product = products.find((item) => item.id === manifestProduct.id);
  if (!product) { errors.push(`preview manifest references unknown product: ${manifestProduct.id}`); continue; }
  if (!Array.isArray(manifestProduct.gallery) || manifestProduct.gallery.length < 5) errors.push(`product preview gallery too small: ${manifestProduct.id}`);
  if (!Array.isArray(product.gallery) || product.gallery.length !== manifestProduct.gallery.length) errors.push(`catalog/manifest preview count mismatch: ${manifestProduct.id}`);
  if (!manifestProduct.inventory?.pdf || !manifestProduct.inventory?.workbook || !Array.isArray(manifestProduct.inventory?.sheets)) errors.push(`incomplete paid inventory: ${manifestProduct.id}`);
  for (const preview of manifestProduct.gallery ?? []) {
    previewCount += 1;
    const publicPath = `public${preview.src}`;
    if (!fs.existsSync(publicPath)) { errors.push(`missing paid product preview: ${publicPath}`); continue; }
    const bytes = fs.readFileSync(publicPath);
    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    if (digest !== preview.sha256) errors.push(`product preview checksum mismatch: ${preview.src}`);
    if (bytes.length !== preview.bytes) errors.push(`product preview byte mismatch: ${preview.src}`);
    if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') errors.push(`invalid PNG preview: ${preview.src}`);
    if (bytes.length < 50000) errors.push(`suspiciously small product preview: ${preview.src}`);
    if (previewHashes.has(digest)) errors.push(`duplicate paid preview image: ${preview.src}`); else previewHashes.add(digest);
    const sourceFile = preview.source?.file;
    if (!sourceFile || !fs.existsSync(sourceFile)) errors.push(`missing canonical preview source: ${preview.src}`);
    if (String(sourceFile).startsWith('public/')) errors.push(`paid source exposed publicly: ${sourceFile}`);
    if (preview.source?.kind === 'xlsx' && (!preview.source.sheet || !preview.source.range)) errors.push(`incomplete XLSX preview provenance: ${preview.src}`);
    if (preview.source?.kind === 'pdf' && !Number.isInteger(preview.source.page)) errors.push(`incomplete PDF preview provenance: ${preview.src}`);
    const catalogPreview = product.gallery.find((item) => item.src === preview.src);
    if (!catalogPreview || catalogPreview.title !== preview.title || catalogPreview.caption !== preview.caption) errors.push(`catalog preview metadata mismatch: ${preview.src}`);
  }
}
if (previewCount !== 20) errors.push(`expected 20 paid product previews, found ${previewCount}`);

const forbiddenFreeLayerPaths = [
  'public/free-downloads',
  'public/free-assets',
  'data/free-assets',
  'components/seo/TrackedDownloadLink.tsx',
  'app/api/download-event/route.ts',
  'migrations/0002_free_asset_downloads.sql',
  'docs/distribution/FREE_ASSET_DISTRIBUTION_PACKET.md',
  'docs/distribution/PINTEREST_ASSET_COPY.md'
];
for (const path of forbiddenFreeLayerPaths) if (fs.existsSync(path)) errors.push(`legacy free-download layer still exists: ${path}`);
if ((ownership.runtime_routes ?? []).includes('/free-downloads')) errors.push('legacy /free-downloads runtime route remains');

const middleware = fs.readFileSync('middleware.ts', 'utf8');
for (const token of ["startsWith('www.')", '308', 'canonicalHostForPath', 'root_action', 'request.nextUrl.clone()']) if (!middleware.includes(token)) errors.push(`middleware missing ${token}`);
if (middleware.includes('/free-downloads/') || middleware.includes('/free-assets/')) errors.push('middleware still whitelists removed free assets');
for (const file of ['app/robots.txt/route.ts', 'app/llms.txt/route.ts', 'app/sitemap.xml/route.ts', 'app/guides/page.tsx']) if (!fs.existsSync(file)) errors.push(`missing SEO route: ${file}`);
for (const file of ['docs/distribution/PAID_PRODUCT_PREVIEW_DISTRIBUTION_PACKET.md', 'docs/distribution/blogger_resource_prospect_ledger.csv', 'docs/distribution/submission_response_tracker.csv', 'docs/distribution/REDDIT_COMMUNITY_CHECKLIST.md', 'docs/distribution/PRODUCT_PREVIEW_PINTEREST_COPY.md', 'data/seo/measurement_ledger.json']) if (!fs.existsSync(file)) errors.push(`missing distribution/measurement artifact: ${file}`);

const reportPath = 'artifacts/authority/admission-report.json';
if (fs.existsSync(reportPath)) {
  const report = read(reportPath).report;
  if (Number(report?.discovered) !== registry.pages.length) errors.push('stale authority admission report');
}

if (errors.length) {
  console.error('SEO RECOVERY VALIDATION FAIL');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`SEO RECOVERY VALIDATION PASS: ${Object.keys(hubs).length} hubs, ${registry.pages.length} guides, ${previewCount} paid previews, 4 canonical hosts, legacy free-download layer absent`);
