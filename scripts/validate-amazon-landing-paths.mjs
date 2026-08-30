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

// ---------------------------------------------------------------------------
// The two orphan pages, and what this gate now asserts about them.
//
// CONVERTED ASSERTION, 2026-08-29.
//
// Until this commit, two of the five book pages were the exception the gate was
// built around: /amazon/wedding-vendor-questions has no matching product at all
// (there is no vendor-questions tool on this site), and
// /amazon/wedding-guest-list-problem has no standalone product either (the guest
// master is a sheet inside the Wedding Seating Chart Maker). Both pages said so
// in their own copy and neither offered the reader anything to buy for the topic
// they had actually come for. The gate's job on those two was to keep that true:
// no invented product, no bundle dressed up as a companion.
//
// The owner overrode that on 2026-08-29, explicitly and after being advised
// otherwise: "i'm not building 3 more products. send them to the bundle then and
// leave it at that. i'm overriding whatever rule." So the assertion is inverted
// rather than deleted. Both pages must now carry a real, live bundle offer that
// posts the bundle SKU to checkout.
//
// What did NOT change is the reason the old assertion existed. A reader arriving
// from a book with a specific expectation is the reader most likely to open a
// mismatch dispute, and the defence is not a rule about checkout buttons, it is
// telling them what the bundle does not contain before they pay. So the inverted
// assertion carries the honesty forward as hard requirements:
//
//   - the offer must name a bundle that exists, has a SKU and a price, has a
//     download manifest entry (so a buyer receives files), and links to a page
//     that renders a checkout control
//   - the offer must carry a non-trivial `excludes` statement, and the page must
//     still say in its own body that the missing product does not exist
//   - the vendor-questions page must never claim the bundle contains a
//     vendor-questions tool; the guest-list page must still say the guest master
//     is a sheet inside the Wedding Seating Chart Maker
//   - the other three book pages must NOT carry a bundle offer, so this stays a
//     scoped exception rather than a new default
//
// Rule 0 applies here too: BUNDLE_PATHS is hardcoded, and examining zero of them
// is a failure, not a pass.
const BUNDLE_SKU = 'DWB-SUITE-001';
const BUNDLE_PATHS = {
  '/amazon/wedding-vendor-questions': {
    // The page must keep saying, in its own text, that the thing the reader came
    // for is not for sale. Any one of these phrasings satisfies it; all of them
    // are statements of absence, which is the point.
    must_state: [/no vendor-questions (product|tool|list)/i, /does not contain one/i],
    // A claim that the suite carries the questions would be the false statement
    // that produces the refund. It must not appear in any form.
    // Word boundaries matter here. Without \b, "Wedding" matches "in" and the
    // check fires on its own honest copy; a guard that cries wolf gets deleted.
    must_not_state: [
      /\bsuite\b[^.]{0,80}\b(contains|includes|holds|adds)\b[^.]{0,40}\bquestions?\b/i,
      /\bquestions?\b[^.]{0,60}\b(are|is)\b\s+\b(in|inside|part of)\b\s+the suite/i,
      /vendor-questions (tool|product)\b[^.]{0,40}\b(in|inside|included in)\b\s+the suite/i,
    ],
  },
  '/amazon/wedding-guest-list-problem': {
    must_state: [/no standalone guest-list product/i, /sheet inside the Wedding Seating Chart Maker/i],
    must_not_state: [
      /standalone guest-list (product|tool)\b[^.]{0,40}\b(in|inside|included in)\b\s+(the )?suite/i,
      /\bsuite\b[^.]{0,80}\b(contains|includes|holds|adds)\b[^.]{0,40}standalone guest-list/i,
    ],
  },
};

const errors = [];
const notes = [];
let examined = 0;
let bundleExamined = 0;

const hubs = read('data/seo/hub_pages.json').pages;
const ownership = read('data/seo/route_ownership.json');
const catalog = read('data/products/product_catalog.json');
const productById = new Map(catalog.products.map((p) => [p.id, p]));

// "Live SKU" means a buyer gets files and the checkout can price it, not just
// that a row exists in the catalog. Both facts are read from the files that own
// them rather than restated here.
const DOWNLOAD_MANIFEST = 'product-builds/manifests/download_manifest.json';
const downloadableIds = new Set(
  exists(DOWNLOAD_MANIFEST) ? read(DOWNLOAD_MANIFEST).products.map((p) => p.product_id) : []
);
if (!exists(DOWNLOAD_MANIFEST)) errors.push(`missing ${DOWNLOAD_MANIFEST} - nothing here can prove a SKU delivers a file`);
// lib/checkout-contract.ts derives this name; the rule is copied from that one
// line rather than invented, and scripts/validate-env.mjs is the list a deploy
// is checked against.
const priceEnvKeyFor = (productId) => `STRIPE_${productId.replaceAll('-', '_').toUpperCase()}_PRICE_ID`;
const envValidatorSrc = exists('scripts/validate-env.mjs') ? fs.readFileSync(path.join(ROOT, 'scripts/validate-env.mjs'), 'utf8') : '';
const priceEnvKeys = new Set(envValidatorSrc.match(/STRIPE_[A-Z_]+_PRICE_ID/g) ?? []);

// The template has to render the offer, or every assertion below is about data
// that never reaches a reader.
const HUB_TEMPLATE = 'components/seo/HubPage.tsx';
if (!exists(HUB_TEMPLATE)) {
  errors.push(`missing ${HUB_TEMPLATE} - the hub template every book page renders through`);
} else {
  // Match the rendered JSX element, not the identifier. A commented-out import
  // still contains the word "CheckoutButton", and an earlier draft of this gate
  // passed while the button had been deleted from the markup - proved on
  // 2026-08-29 by stripping the element and watching it stay green.
  const tpl = fs.readFileSync(path.join(ROOT, HUB_TEMPLATE), 'utf8');
  if (!/bundleOffer\s*&&/.test(tpl)) errors.push(`${HUB_TEMPLATE} does not branch on a resolved bundle offer, so a declared bundle offer would never render`);
  if (!/<CheckoutButton[^>]*\bsku=\{[^}]*bundle[^}]*\}/i.test(tpl)) errors.push(`${HUB_TEMPLATE} renders no <CheckoutButton> bound to the bundle SKU, so a bundle offer would show no way to pay`);
  if (!/\{\s*bundleOffer\.offer\.excludes\s*\}/.test(tpl)) errors.push(`${HUB_TEMPLATE} does not render bundle_offer.excludes, so the page would sell the bundle without printing what it leaves out`);
}

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

  // -------------------------------------------------------------------------
  // The converted orphan-page assertion. See BUNDLE_PATHS above for why this
  // reads the way it does.
  const bundleRule = BUNDLE_PATHS[bookPath];
  if (bundleRule) {
    bundleExamined += 1;
    const offer = hub.bundle_offer;
    if (!offer) {
      errors.push(`${bookPath}: no bundle_offer on the hub record. This page has no product of its own, so without a bundle offer it gives a paying reader nothing to buy. The owner decided on 2026-08-29 that it must.`);
    } else {
      const bundle = productById.get(offer.product_id);
      if (!bundle) {
        errors.push(`${bookPath}: bundle_offer.product_id "${offer.product_id}" is not in the product catalog`);
      } else {
        if (bundle.sku !== BUNDLE_SKU) errors.push(`${bookPath}: bundle_offer resolves to SKU ${bundle.sku}, but the bundle these pages must sell is ${BUNDLE_SKU}`);
        if (!bundle.price) errors.push(`${bookPath}: bundle ${bundle.id} has no price, so the offer cannot state what it costs`);
        // Live, not just declared: a SKU a buyer cannot receive files for is a
        // chargeback, not a sale.
        if (!downloadableIds.has(bundle.id)) errors.push(`${bookPath}: bundle ${bundle.id} has no entry in ${DOWNLOAD_MANIFEST}, so a buyer would pay and receive nothing`);
        if (!priceEnvKeys.has(priceEnvKeyFor(bundle.id))) errors.push(`${bookPath}: ${priceEnvKeyFor(bundle.id)} is not declared in scripts/validate-env.mjs, so checkout for this SKU would 503 at runtime`);
      }
      // The offer must link somewhere that can actually take the money.
      const offerPage = offer.href === '/shop' ? 'app/shop/page.tsx' : `app${offer.href}/page.tsx`;
      if (!exists(offerPage)) {
        errors.push(`${bookPath}: bundle_offer.href "${offer.href}" has no page at ${offerPage}`);
      } else if (!/CheckoutButton|StickyPurchaseBar/.test(fs.readFileSync(path.join(ROOT, offerPage), 'utf8'))) {
        errors.push(`${bookPath}: ${offerPage} renders no checkout control, so the bundle link is a dead end`);
      }
      // The honesty half of the converted assertion.
      if (!offer.excludes || offer.excludes.trim().length < 60) {
        errors.push(`${bookPath}: bundle_offer.excludes is missing or too short to be a real statement. This page sells a bundle that does not match the book's topic; saying what it does not contain, before payment, is the whole reason the offer is allowed here.`);
      }
      if (!Array.isArray(offer.includes) || offer.includes.length === 0) {
        errors.push(`${bookPath}: bundle_offer.includes is empty, so the page sells a bundle without listing its contents`);
      }
    }

    // Statements of absence must survive, and the false claim must never appear.
    // Read the whole record, not just the offer, so moving the sentence around
    // does not defeat the check.
    const body = JSON.stringify(hub);
    for (const pattern of bundleRule.must_state) {
      if (!pattern.test(body)) errors.push(`${bookPath}: the page no longer states ${pattern}. It sells a bundle that does not match the book's topic, and the statement of what is missing is what keeps that honest.`);
    }
    for (const pattern of bundleRule.must_not_state) {
      if (pattern.test(body)) errors.push(`${bookPath}: the page appears to claim the bundle contains something it does not (${pattern}). That is the false statement that produces refunds and chargebacks.`);
    }
  } else if (hub.bundle_offer) {
    errors.push(`${bookPath}: carries a bundle_offer, but this page has a product of its own. The bundle offer is a scoped exception for the two pages whose topic has no matching SKU, not a default.`);
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
// Rule 0 for the converted half. If the two orphan pages stop being examined -
// renamed, removed from BOOK_PATHS, or dropped from BUNDLE_PATHS - the bundle
// assertion has not passed, it has evaporated.
const declaredBundlePaths = Object.keys(BUNDLE_PATHS).length;
if (bundleExamined !== declaredBundlePaths || declaredBundlePaths === 0) {
  console.error(`AMAZON LANDING PATHS: examined ${bundleExamined} of ${declaredBundlePaths} bundle-offer pages. The converted orphan-page assertion cannot pass without checking both.`);
  process.exit(2);
}

// The wiring is printed rather than written to an artifact file: this repo
// requires scripts/validate-*.mjs to inspect only (scripts/validate-profile-purity.mjs),
// and a gate that writes its own evidence is a gate that can be read from its
// output instead of from a run. stdout is the record.
for (const bookPath of BOOK_PATHS) {
  const hub = hubs[bookPath.slice(1)];
  const product = hub ? productById.get(hub.product_id) : null;
  const offer = hub?.bundle_offer;
  const bundle = offer ? productById.get(offer.product_id) : null;
  const bundleNote = bundle ? `  +BUNDLE ${bundle.sku} ($${bundle.price}, ${offer.href})` : '';
  console.log(`  ${bookPath}  ->  ${product ? `${product.sku} (${product.id}, $${product.price}, ${product.route})` : 'NO PRODUCT'}${bundleNote}`);
}
for (const note of notes) console.log(`  NOTE   ${note}`);
if (errors.length) {
  console.error(`AMAZON LANDING PATHS FAIL: ${errors.length} problem(s) across ${examined} book path(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`amazon landing paths: PASS (${examined} book paths, ${bundleExamined} bundle offers on ${BUNDLE_SKU}, sitemap ${SITEMAP}, build output ${buildDir ? 'checked' : 'ABSENT'})`);
