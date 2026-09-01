#!/usr/bin/env node
// GUARD: a persistent planner entry exists on every page type except the
// suppression list, and the pill's dismissal is actually persisted.
//
// Two separate failure modes, both silent:
//
//   1. A page type that renders outside AppShell would have no planner entry at
//      all, and nobody would find out from looking at a guide.
//   2. A dismiss button that does not write to storage re-nags the reader on every
//      page. That is worse than having no dismiss button, because it teaches them
//      the control does not work.
//
// Rule 0: the route enumeration below hard-fails when it finds nothing.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const failures = [];
const fail = (message) => failures.push(message);

// --- 1. Every page type routes through AppShell ------------------------------
// The banner is the persistent entry. It lives in AppShell, so "every page" is
// true exactly as long as every page is inside AppShell.
const layout = read('app/layout.tsx');
if (!layout.includes('AppShell')) fail('app/layout.tsx: does not render AppShell, so the persistent planner entry is not global');
const shell = read('components/AppShell.tsx');
if (!shell.includes('data-testid="planner-banner"')) fail('AppShell: the persistent planner banner is gone');
if (!shell.includes('PlannerCtaProvider')) fail('AppShell: the planner pill provider is not mounted');

// A nested layout that replaces the shell would remove the entry for its subtree.
const nestedLayouts = fs.readdirSync(path.join(ROOT, 'app'), { recursive: true })
  .filter((entry) => String(entry).endsWith('layout.tsx') && String(entry) !== 'layout.tsx')
  .map((entry) => `app/${entry}`);
for (const file of nestedLayouts) {
  const source = read(file);
  if (/<html|<body/.test(source)) fail(`${file}: declares its own document, escaping AppShell and the persistent planner entry`);
}

// --- 2. The suppression list is explicit and the pill honours it -------------
const pill = read('components/PlannerCta.tsx');
const suppressed = [...pill.matchAll(/^\s+(?:PLANNER_ROUTE,|'(\/[a-z-]+)',?)\s*\/\//gm)].map((match) => match[1] ?? 'PLANNER_ROUTE');
if (!pill.includes('export function isPlannerPillSuppressed')) fail('PlannerCta: no exported suppression predicate, so nothing can be tested');
if (suppressed.length === 0) fail('PlannerCta: examined 0 suppression entries - the list is empty or unreadable');

const ownership = JSON.parse(read('data/seo/route_ownership.json'));
const routes = (ownership.routes ?? []).map((route) => route.path);
if (routes.length === 0) fail('route_ownership.json: examined 0 routes');
const suppressedPrefixes = ['/free-wedding-planner', '/products', '/shop', '/order', '/pack', '/dashboard', '/admin'];
const covered = routes.filter((route) => suppressedPrefixes.some((prefix) => route === prefix || route.startsWith(`${prefix}/`)));
const carrying = routes.filter((route) => !covered.includes(route));
if (carrying.length === 0) fail('every published route is on the suppression list - the pill would never appear anywhere');
for (const prefix of suppressedPrefixes) {
  if (!pill.includes(`'${prefix}'`) && !(prefix === '/free-wedding-planner' && pill.includes('PLANNER_ROUTE'))) {
    fail(`PlannerCta: ${prefix} is treated as suppressed by this guard but is not in PLANNER_PILL_SUPPRESSED_PREFIXES`);
  }
}

// --- 3. Dismissal is persisted -----------------------------------------------
if (!pill.includes('PLANNER_PILL_DISMISS_KEY')) fail('PlannerCta: no dismissal storage key');
if (!/localStorage\.setItem\(PLANNER_PILL_DISMISS_KEY/.test(pill)) fail('PlannerCta: dismissal is never written to storage, so it does not survive a page load');
if (!/localStorage\.getItem\(PLANNER_PILL_DISMISS_KEY/.test(pill)) fail('PlannerCta: dismissal is never read back, so a stored dismissal has no effect');
if (!pill.includes('data-testid="planner-pill-dismiss"')) fail('PlannerCta: the dismiss control is not addressable, so the persistence proof cannot run');

// --- 4. Accessibility basics -------------------------------------------------
if (!/aria-label="Dismiss/.test(pill)) fail('PlannerCta: dismiss control has no accessible name');
if (!/role="complementary"/.test(pill)) fail('PlannerCta: the pill has no landmark role');
if (!pill.includes('motion-safe:')) fail('PlannerCta: entrance animation is not gated on motion-safe');

console.log(`planner persistent entry: routes=${routes.length} carrying=${carrying.length} suppressed=${covered.length} nested_layouts=${nestedLayouts.length}`);
if (failures.length) {
  for (const message of failures) console.error(`  FAIL ${message}`);
  console.error(`planner persistent entry: FAIL (${failures.length} problem(s))`);
  process.exit(1);
}
console.log(`planner persistent entry: PASS (${carrying.length} routes carry the entry, ${covered.length} deliberately suppressed)`);
