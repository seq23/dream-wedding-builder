#!/usr/bin/env node
// GUARD: every paid product remains reachable from at least one plan state.
//
// Before this guard, three of the four paid products were reachable from the
// planner only through a single bundled "compare prices" link. The planner is the
// free tool the whole site now points at, so a product that cannot be reached
// from a plan state is a product with no path from the traffic.
//
// "Plan state" means the planner renders a route to it. The reasons attached to
// those routes are derived from the plan, so this also fails if the working-files
// block degenerates into a static grid with no relationship to the plan.
//
// Rule 0: zero products examined is a hard failure, not an empty pass.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const failures = [];
const fail = (message) => failures.push(message);

const catalog = JSON.parse(read('data/products/product_catalog.json'));
const products = catalog.products ?? [];
if (products.length === 0) fail('product catalog: examined 0 products - nothing to check');

const planner = read('app/free-wedding-planner/page.tsx');

const unreachable = [];
for (const product of products) {
  if (!product.route) { fail(`product ${product.id}: no route in the catalog`); continue; }
  if (!planner.includes(product.route)) unreachable.push(`${product.id} (${product.route})`);
}
for (const item of unreachable) fail(`product not reachable from any plan state: ${item}`);

// The block must exist and must be plan-derived, not a static price grid.
if (!planner.includes('data-testid="planner-working-files"')) fail('planner: no working-files block, so products are only reachable through the bundled shop link');
const block = planner.match(/data-testid="planner-working-files"[\s\S]*?<\/section>/);
if (!block) fail('planner: working-files block could not be read');
else {
  const reasons = [...planner.matchAll(/reason: (plan\.[A-Za-z]+) \?/g)].map((match) => match[1]);
  if (reasons.length === 0) fail('planner: working-files reasons are not derived from the plan - a static product grid is not a plan state');
  if (reasons.length < products.length - 1) fail(`planner: only ${reasons.length} of the paid files carry a plan-derived reason`);
  for (const product of products) {
    if (product.id === 'operations-suite') continue; // the suite is the bundle, reached through /shop
    if (!planner.includes(`data-testid={\`planner-product-\${file.id}\`}`) && !planner.includes(`planner-product-${product.id}`)) {
      fail(`product ${product.id}: not individually addressable in the working-files block`);
    }
  }
}

// The planner must not become a storefront. If the free tool loses its free
// framing, the whole reason the site points at it is gone.
if (!/free and stays free|planner itself is free/i.test(planner)) fail('planner: the working-files block does not state that the planner itself remains free');

console.log(`product reachability: products=${products.length} unreachable=${unreachable.length}`);
if (failures.length) {
  for (const message of failures) console.error(`  FAIL ${message}`);
  console.error(`product reachability: FAIL (${failures.length} problem(s))`);
  process.exit(1);
}
console.log(`product reachability: PASS (all ${products.length} paid products reachable from a plan state)`);
