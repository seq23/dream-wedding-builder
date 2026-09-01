#!/usr/bin/env node
// GUARD: the free planner is reachable from the desktop nav on every configured
// host, from every shipping guide, and from every landing page.
//
// This exists because the planner shipped in the mobile nav and the footer and
// was missing from the desktop nav for six days, and nothing noticed. A link that
// is present on one breakpoint is not a navigation entry, it is an accident.
//
// Rule 0: every section below counts what it examined and fails when the count is
// zero. A guard that passes because it found nothing to check is the defect it
// was written to prevent.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const failures = [];
const counts = {};

function fail(message) { failures.push(message); }
function examined(name, n) {
  counts[name] = n;
  if (n === 0) fail(`${name}: examined 0 items - nothing to validate means the guard cannot be trusted`);
}

// --- 1. Desktop nav, on every configured host --------------------------------
const shell = read('components/AppShell.tsx');
const ownership = JSON.parse(read('data/seo/route_ownership.json'));
const hosts = Object.keys(ownership.hosts ?? {});
examined('configured hosts', hosts.length);

const desktopNav = shell.match(/aria-label="Primary navigation"[\s\S]*?<\/nav>/);
if (!desktopNav) fail('AppShell: no desktop nav (aria-label="Primary navigation") found');
else {
  if (!desktopNav[0].includes('data-testid="desktop-nav-planner"')) fail('AppShell desktop nav: no planner entry (data-testid="desktop-nav-planner")');
  if (!desktopNav[0].includes('PLANNER_ABSOLUTE')) fail('AppShell desktop nav: planner entry does not link to PLANNER_ABSOLUTE');
  // The nav is one component shared by all five domains. A per-host conditional
  // around the planner entry would silently drop it on some of them, which is the
  // failure mode this section exists to catch.
  if (/siteLinks\[[^\]]*\][^\n]*desktop-nav-planner/.test(desktopNav[0])) fail('AppShell desktop nav: planner entry is behind a per-host conditional');
}

// The banner is the always-on entry, above the nav, on every page of every host.
if (!shell.includes('data-testid="planner-banner"')) fail('AppShell: no persistent planner banner');
if (!/data-testid="planner-banner"[\s\S]{0,600}PLANNER_ABSOLUTE/.test(shell)) fail('AppShell banner: does not link to the planner');

// Mobile nav and footer keep their existing entries; losing them is a regression.
const mobileNav = shell.match(/aria-label="Mobile navigation"[\s\S]*?<\/nav>/);
if (!mobileNav) fail('AppShell: no mobile nav found');
else if (!mobileNav[0].includes('PLANNER_ABSOLUTE')) fail('AppShell mobile nav: planner entry missing');
const footer = shell.match(/<footer[\s\S]*?<\/footer>/);
if (!footer) fail('AppShell: no footer found');
else if (!footer[0].includes('PLANNER_ABSOLUTE')) fail('AppShell footer: planner entry missing');

// --- 2. Every shipping guide -------------------------------------------------
const registry = JSON.parse(read('data/authority/content_registry.json'));
const guideTemplate = read('app/guides/[slug]/page.tsx');
const shipping = (registry.pages ?? []).filter((page) => Array.isArray(page.faqs) && page.faqs.length > 0 && Array.isArray(page.steps) && page.steps.length > 0);
examined('shipping guides', shipping.length);
if (!guideTemplate.includes('data-testid="guide-planner-entry"')) fail('guide template: no planner entry section');
if (!guideTemplate.includes('seedFromGuide(page)')) fail('guide template: planner entry carries no seed derived from the guide');
if (!guideTemplate.includes('plannerLabelForGuide(page)')) fail('guide template: planner entry uses a generic label rather than the guide\'s own data');

// The template is shared, so proving it renders an entry proves it for every
// guide - provided every guide's cluster can produce a focus. The mapping is read
// out of lib/planner-seed.ts rather than restated here: a second copy of it would
// let the guard agree with itself while disagreeing with the code.
const seedSource = read('lib/planner-seed.ts');
if (!seedSource.includes('export function seedFromGuide')) fail('lib/planner-seed.ts: seedFromGuide is gone; the guide entry cannot be seeded');
if (!seedSource.includes('export function plannerLabelForGuide')) fail('lib/planner-seed.ts: plannerLabelForGuide is gone');
const mappedClusters = new Set([...seedSource.matchAll(/'(Wedding [a-z ]+)': '[^']+'/g)].map((match) => match[1]));
const registryClusters = [...new Set(shipping.map((page) => page.cluster))];
examined('guide clusters', registryClusters.length);
for (const cluster of registryClusters) {
  if (!mappedClusters.has(cluster)) fail(`guide cluster "${cluster}" has no studio focus in lib/planner-seed.ts, so its guides would seed generically`);
}

// --- 3. Every landing page ---------------------------------------------------
const landingSource = read('data/planner-landings.ts');
const landingSlugs = [...landingSource.matchAll(/^\s{4}slug: '([^']+)'/gm)].map((match) => match[1]);
examined('landing pages', landingSlugs.length);
for (const slug of landingSlugs) {
  const file = `app/${slug}/page.tsx`;
  if (!fs.existsSync(path.join(ROOT, file))) { fail(`landing ${slug}: no route file at ${file}`); continue; }
  if (!read(file).includes('PlannerLandingPage')) fail(`landing ${slug}: route does not render the landing template`);
}
const renderer = read('components/PlannerLandingPage.tsx');
if (!renderer.includes('data-testid="landing-planner-link"')) fail('landing template: no planner link');
if (!renderer.includes('plannerHref(landing.seed)')) fail('landing template: planner link carries no seed');

// --- report ------------------------------------------------------------------
console.log('planner reachability:', Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' '));
if (failures.length) {
  for (const message of failures) console.error(`  FAIL ${message}`);
  console.error(`planner reachability: FAIL (${failures.length} problem(s))`);
  process.exit(1);
}
console.log(`planner reachability: PASS (${counts['configured hosts']} hosts, ${counts['shipping guides']} guides, ${counts['landing pages']} landing pages)`);
