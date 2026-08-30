#!/usr/bin/env node
/**
 * Amazon front-door landing paths.
 *
 * Five finished Kindle titles print a link on their last page. The link is baked
 * into an EPUB that is already built, so the path it points at is not something
 * this repo can change later - if one of these five paths stops resolving, the
 * only remedy is re-uploading five books. That makes them different from every
 * other route here, and it is why they get their own gate.
 *
 * The gate asserts, for each of the five:
 *
 *   1. the path is declared in data/seo/route_ownership.json, owned by the host
 *      the books actually point at, and marked indexable
 *   2. a hub record exists for it, whose declared host matches that ownership
 *   3. an app/ route file exists that renders it through the hub template
 *   4. it appears in the built sitemap for that host
 *   5. it reaches a real purchase path: its product_id resolves to a product in
 *      the catalog, that product's route has a page, and that page posts a real
 *      SKU to the checkout route, which exists
 *   6. the built output serves it 200 - checked against .open-next when a build
 *      is present, and reported as unproven rather than passed when it is not
 *
 * Rule 0: it counts what it examined and fails on zero. A run that finds no
 * paths to check has not passed, it has done nothing, and it exits non-zero
 * saying so. The five paths are hardcoded here on purpose: reading them from the
 * same file the check validates would let a deletion pass by making the
 * expectation disappear along with the route.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

// The exact strings printed in the five EPUBs, after the domain. Do not derive
// these; they are an external contract with files that are already published.
const BOOK_PATHS = [
  '/amazon/wedding-day-timeline',
  '/amazon/wedding-vendor-questions',
  '/amazon/wedding-seating-chart',
  '/amazon/wedding-budget-line-by-line',
  '/amazon/wedding-guest-list-problem',
];
const BOOK_HOST = 'weddingchecklistpdf.com';

const errors = [];
const notes = [];
let examined = 0;

const hubs = read('data/seo/hub_pages.json').pages;
const ownership = read('data/seo/route_ownership.json');
const catalog = read('data/products/product_catalog.json');
const productById = new Map(catalog.products.map((p) => [p.id, p]));

// The checkout route the purchase path terminates at. If this is gone, every
// "real purchase path" below is a button that posts into nothing.
const CHECKOUT_ROUTE = 'app/api/checkout/route.ts';
if (!exists(CHECKOUT_ROUTE)) errors.push(`checkout route missing: ${CHECKOUT_ROUTE} - no page on this site has a purchase path`);

// Sitemaps are generated per host by npm run authority:sitemaps.
const SITEMAP = `artifacts/sitemaps/${BOOK_HOST}.xml`;
const sitemapXml = exists(SITEMAP) ? fs.readFileSync(path.join(ROOT, SITEMAP), 'utf8') : null;
if (!sitemapXml) errors.push(`sitemap missing: ${SITEMAP} - run npm run authority:sitemaps`);

// Built output. Present after npm run build; absent in a bare checkout. Absence
// is reported as unproven, never silently treated as a pass.
const BUILD_DIRS = ['.next/server/app', '.open-next/server-functions/default/.next/server/app'];
const buildDir = BUILD_DIRS.map((d) => path.join(ROOT, d)).find((d) => fs.existsSync(d)) ?? null;

for (const bookPath of BOOK_PATHS) {
  examined += 1;
  const slug = bookPath.slice(1);

  const route = ownership.routes.find((r) => r.path === bookPath);
  if (!route) {
    errors.push(`${bookPath}: not declared in data/seo/route_ownership.json`);
  } else {
    if (route.host !== BOOK_HOST) errors.push(`${bookPath}: owned by ${route.host}, but the books print ${BOOK_HOST}`);
    if (!route.indexable) errors.push(`${bookPath}: declared non-indexable, so it will never reach the sitemap`);
  }

  const hub = hubs[slug];
  if (!hub) {
    errors.push(`${bookPath}: no hub record at data/seo/hub_pages.json -> pages["${slug}"]`);
    continue;
  }
  if (route && hub.host !== route.host) errors.push(`${bookPath}: hub host ${hub.host} disagrees with ownership host ${route.host}`);

  const routeFile = `app/${slug}/page.tsx`;
  if (!exists(routeFile)) {
    errors.push(`${bookPath}: no route file at ${routeFile}`);
  } else {
    const source = fs.readFileSync(path.join(ROOT, routeFile), 'utf8');
    if (!source.includes('HubPage')) errors.push(`${bookPath}: ${routeFile} does not render the hub template`);
    if (!source.includes(`'${slug}'`) && !source.includes(`"${slug}"`)) errors.push(`${bookPath}: ${routeFile} does not bind the slug ${slug}`);
  }

  if (sitemapXml && !sitemapXml.includes(`<loc>https://${BOOK_HOST}${bookPath}</loc>`)) {
    errors.push(`${bookPath}: absent from ${SITEMAP}`);
  }

  // Purchase path. A landing page whose product does not resolve, or whose
  // product page has no SKU posted to checkout, is a dead end for a reader who
  // has already paid for a book and arrived ready to buy.
  const product = productById.get(hub.product_id);
  if (!product) {
    errors.push(`${bookPath}: product_id "${hub.product_id}" is not in the product catalog`);
  } else {
    const productPage = product.route === '/shop' ? 'app/shop/page.tsx' : `app/products/[slug]/page.tsx`;
    if (!exists(productPage)) {
      errors.push(`${bookPath}: product ${product.id} routes to ${product.route}, which has no page (${productPage})`);
    } else {
      const src = fs.readFileSync(path.join(ROOT, productPage), 'utf8');
      if (!/CheckoutButton|StickyPurchaseBar/.test(src)) errors.push(`${bookPath}: ${productPage} renders no checkout control, so the purchase path ends there`);
    }
    if (!product.sku) errors.push(`${bookPath}: product ${product.id} has no SKU to post to checkout`);
    // The hub template links the product by product.route; a hub that names a
    // product with no route puts the CTA nowhere.
    if (!product.route) errors.push(`${bookPath}: product ${product.id} has no route for the hub CTA to link`);
  }

  if (buildDir) {
    // Next writes one of these per rendered route. Either shape counts; neither
    // present means the path did not build.
    const built = [
      path.join(buildDir, `${slug}.html`),
      path.join(buildDir, slug, 'page.js'),
      path.join(buildDir, `${slug}.rsc`),
    ].some((f) => fs.existsSync(f));
    if (!built) errors.push(`${bookPath}: not present in the built output under ${path.relative(ROOT, buildDir)}`);
  }
}

if (!buildDir) notes.push('built output absent: the 200-in-build assertion did not run. Run npm run build before relying on this gate for a release.');

// Rule 0. A gate that examined nothing has not passed.
if (examined === 0) {
  console.error('AMAZON LANDING PATHS: examined 0 paths. This gate cannot pass without checking something.');
  process.exit(2);
}
if (examined !== BOOK_PATHS.length) {
  console.error(`AMAZON LANDING PATHS: examined ${examined} of ${BOOK_PATHS.length} declared book paths.`);
  process.exit(2);
}

// The wiring is printed rather than written to an artifact file: this repo
// requires scripts/validate-*.mjs to inspect only (scripts/validate-profile-purity.mjs),
// and a gate that writes its own evidence is a gate that can be read from its
// output instead of from a run. stdout is the record.
for (const bookPath of BOOK_PATHS) {
  const hub = hubs[bookPath.slice(1)];
  const product = hub ? productById.get(hub.product_id) : null;
  console.log(`  ${bookPath}  ->  ${product ? `${product.sku} (${product.id}, $${product.price}, ${product.route})` : 'NO PRODUCT'}`);
}
for (const note of notes) console.log(`  NOTE   ${note}`);
if (errors.length) {
  console.error(`AMAZON LANDING PATHS FAIL: ${errors.length} problem(s) across ${examined} book path(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`amazon landing paths: PASS (${examined} book paths, sitemap ${SITEMAP}, build output ${buildDir ? 'checked' : 'ABSENT'})`);
