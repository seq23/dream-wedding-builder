#!/usr/bin/env node
/**
 * The post-payment path must exist, and the lists that describe it must be linked.
 *
 * Why this validator exists
 * -------------------------
 * On 2026-08-29 both `app/api/stripe-webhook/route.ts` and
 * `app/api/download/[token]/route.ts` were deleted and the entire gate stayed
 * green: typecheck passed (nothing imports a route handler), all 54 unit tests
 * passed, `validate:structural` passed, and `validate:registry` reported
 * passed=21 hard_failed=0. Deleting the only code that turns a Stripe payment
 * into a delivered file was invisible to CI.
 *
 * The reason is structural, not accidental. Next.js routes are reached by file
 * path, so no import graph and therefore no type check or unit test can notice
 * that one is gone, and every existing validator checked data files
 * (catalog, manifests) or the checkout entry point only. The one leg that is
 * genuinely covered in CI is checkout itself, via lib/__tests__/checkout-route.test.ts.
 *
 * It also links lists that were each maintained on their own:
 *
 *   - lib/checkout-contract.ts DERIVES the Stripe price env var name from the
 *     product id; scripts/validate-env.mjs RESTATES five of them by hand. A
 *     sixth catalog product would produce a route that 503s at runtime with
 *     nothing in CI to say so.
 *   - lib/fulfillment.ts DERIVES the R2 object key; scripts/validate-downloads.mjs
 *     RESTATES the same shape as a string literal in the validator, so a change
 *     to lib/fulfillment.ts alone would be compared only against a copy of its
 *     own old value.
 *   - the webhook MINTS a download URL as a path string; nothing checked that a
 *     route existed at that path.
 *
 * Every assertion here is derived from the catalog or from the source that owns
 * the rule. Nothing is restated. Zero products examined is a hard failure.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const readFile = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readJson = (rel) => JSON.parse(readFile(rel));
const failures = [];
const fail = (msg) => failures.push(msg);

// ---------------------------------------------------------------------------
// 1. Every leg of the money path exists as a file.
//
// These four are the whole path: take money, turn a paid session into an
// entitlement, turn an entitlement into a file, and re-issue an expired link.
// Remove any one and a paying customer gets nothing.
const REQUIRED_ROUTES = [
  ['app/api/checkout/route.ts', 'creates the Stripe Checkout Session'],
  ['app/api/stripe-webhook/route.ts', 'turns a paid session into an order + entitlement and emails the link'],
  ['app/api/download/[token]/route.ts', 'turns a signed token into the purchased file from R2'],
  ['app/api/order-status/route.ts', 're-issues a download link after the first one expires'],
];
if (!REQUIRED_ROUTES.length) {
  console.error('fulfillment path: no routes to examine - this validator would pass having checked nothing');
  process.exit(1);
}
let routesPresent = 0;
for (const [rel, why] of REQUIRED_ROUTES) {
  if (fs.existsSync(path.join(ROOT, rel))) routesPresent += 1;
  else fail(`missing ${rel} - ${why}. A paid customer cannot be served without it.`);
}

// ---------------------------------------------------------------------------
// 2. The link the webhook mints must point at a route that exists.
//
// Read the path the code actually builds rather than asserting a path this
// validator believes in.
const webhookSrc = fs.existsSync(path.join(ROOT, 'app/api/stripe-webhook/route.ts'))
  ? readFile('app/api/stripe-webhook/route.ts') : '';
const orderStatusSrc = fs.existsSync(path.join(ROOT, 'app/api/order-status/route.ts'))
  ? readFile('app/api/order-status/route.ts') : '';
const mintedPaths = new Set();
for (const src of [webhookSrc, orderStatusSrc]) {
  for (const m of src.matchAll(/\/api\/download\/\$\{[^}]+\}/g)) mintedPaths.add(m[0].replace(/\$\{[^}]+\}/, '[token]'));
}
if (!mintedPaths.size && (webhookSrc || orderStatusSrc)) {
  fail('neither the webhook nor order-status builds a /api/download/<token> URL - the purchased file is never handed to the buyer');
}
for (const p of mintedPaths) {
  const routeFile = path.join(ROOT, 'app', p.replace(/^\//, ''), 'route.ts');
  if (!fs.existsSync(routeFile)) fail(`code mints ${p} but there is no route at ${path.relative(ROOT, routeFile)} - the download link would 404`);
}

// ---------------------------------------------------------------------------
// 3. The security properties the money path depends on.
//
// Text-level, deliberately: the point is that gutting a leg cannot be silent,
// not to re-test behaviour lib/__tests__ already covers.
const PATH_INVARIANTS = [
  ['app/api/stripe-webhook/route.ts', 'verifyStripeSignature', 'an unsigned request could mint an entitlement without payment'],
  ['app/api/stripe-webhook/route.ts', 'STRIPE_WEBHOOK_SECRET', 'the signature has nothing to verify against'],
  ['app/api/stripe-webhook/route.ts', 'INSERT INTO entitlements', 'a paid order would grant nothing'],
  ['app/api/download/[token]/route.ts', 'verifyDownloadToken', 'any token string would serve a paid file'],
  ['app/api/download/[token]/route.ts', 'PRODUCT_RELEASES', 'the file is never read from the release bucket'],
  ['app/api/download/[token]/route.ts', 'entitlements', 'the token would not be checked against a purchase'],
];
// Import lines are stripped first. Replacing `verifyStripeSignature(...)` with
// `true` leaves the import untouched, so a whole-file grep still saw the name and
// passed a route that had stopped checking signatures - proved on 2026-08-29.
const bodyOf = (rel) => readFile(rel)
  .split('\n')
  .filter((line) => !/^\s*import\b/.test(line))
  .join('\n');
for (const [rel, token, why] of PATH_INVARIANTS) {
  if (!fs.existsSync(path.join(ROOT, rel))) continue; // already reported above
  if (!bodyOf(rel).includes(token)) fail(`${rel} no longer uses ${token} outside its imports - ${why}`);
}

// ---------------------------------------------------------------------------
// 4. Derived Stripe price env keys vs the list validate-env requires.
//
// The derivation rule lives in lib/checkout-contract.ts. Assert the rule is
// still the one implemented there, then apply it to every catalog product and
// require the result on both sides.
const contractSrc = readFile('lib/checkout-contract.ts');
const RULE = 'STRIPE_${productId.replaceAll(\'-\', \'_\').toUpperCase()}_PRICE_ID';
if (!contractSrc.includes(RULE)) {
  fail(`lib/checkout-contract.ts no longer derives the price env key as ${RULE}; update this validator's rule alongside it rather than letting the two drift`);
}
const priceEnvKeyForProduct = (id) => `STRIPE_${id.replaceAll('-', '_').toUpperCase()}_PRICE_ID`;

const catalog = readJson('data/products/product_catalog.json');
const products = catalog.products || catalog;
if (!Array.isArray(products) || products.length === 0) {
  console.error('fulfillment path: product catalog is empty - refusing to pass having examined no products');
  process.exit(1);
}
const envValidatorSrc = readFile('scripts/validate-env.mjs');
const envExamples = ['.env.example', '.dev.vars.example'];
for (const product of products) {
  const key = priceEnvKeyForProduct(product.id);
  if (!envValidatorSrc.includes(key)) {
    fail(`${product.id}: scripts/validate-env.mjs does not require ${key}, so checkout for this product can 503 in production with a green CI`);
  }
  for (const file of envExamples) {
    if (!new RegExp(`^${key}=`, 'm').test(readFile(file))) fail(`${product.id}: ${key} is absent from ${file}`);
  }
}

// ---------------------------------------------------------------------------
// 5. R2 key shape: derived in lib/fulfillment.ts, restated in the manifest and
// in validate-downloads.mjs. Compare the manifest against the code's own rule.
const fulfillmentSrc = readFile('lib/fulfillment.ts');
const keyTemplate = (fulfillmentSrc.match(/return\s+`(products\/[^`]+)`/) || [])[1];
if (!keyTemplate) {
  fail('could not read the R2 key template out of lib/fulfillment.ts releaseKeyForSku - the manifest can no longer be checked against the code that serves it');
} else {
  const releases = readJson('product-builds/r2/release_manifest.json').releases || [];
  if (!releases.length) {
    console.error('fulfillment path: release manifest lists no releases - refusing to pass having examined nothing');
    process.exit(1);
  }
  for (const release of releases) {
    const expected = keyTemplate.replace('${product.id}', release.product_id);
    if (release.r2_key !== expected) {
      fail(`${release.product_id}: release_manifest r2_key is "${release.r2_key}" but lib/fulfillment.ts serves "${expected}" - the buyer would get a 404 from R2`);
    }
  }
}

if (failures.length) {
  console.error('FULFILLMENT PATH VALIDATION FAILED');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`fulfillment path: PASS (${routesPresent}/${REQUIRED_ROUTES.length} routes, ${mintedPaths.size} minted download path(s), ${products.length} products with derived price env keys, ${PATH_INVARIANTS.length} path invariants)`);
