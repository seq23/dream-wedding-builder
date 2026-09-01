#!/usr/bin/env node
// GUARD: the positioning sentence on /methodology stays true of the shipped
// product, and stays defensible.
//
// Three ways this specific paragraph goes wrong, all of them silent:
//
//   1. It becomes a promise the tool does not keep. The first draft of this
//      section claimed Step 3 "computes" the answer to "I only have $18,000,
//      what do I change". It does not - it flags the per-guest risk, names the
//      protected priorities, and names where cutting starts. A page that
//      overstates its own tool is worse than a page with no positioning.
//   2. The worked example gets transcribed instead of computed, and then
//      data/planning.ts changes underneath it.
//   3. The contrast drifts from "against a category" to "against a competitor",
//      which is neither defensible nor quotable.
//
// Rule 0: every section counts what it examined and fails on zero.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const failures = [];
const fail = (message) => failures.push(message);

const page = read('app/methodology/page.tsx');
const planning = read('data/planning.ts');

// --- 1. The contrast is present and stated once ------------------------------
if (!page.includes('data-testid="methodology-contrast"')) fail('/methodology: the category contrast section is gone');
const contrastMatches = [...page.matchAll(/const CONTRAST = '([^']+)'/g)];
if (contrastMatches.length !== 1) fail(`/methodology: expected exactly one CONTRAST definition, found ${contrastMatches.length}`);
const contrast = contrastMatches[0]?.[1] ?? '';
if (!/calculator/i.test(contrast)) fail('/methodology: the contrast does not name the category it contrasts with');
if (!/\{CONTRAST\}/.test(page)) fail('/methodology: the contrast constant is defined but never rendered');

// --- 2. The contrast reaches the structured data -----------------------------
const definedTerm = page.match(/'@type': 'DefinedTerm'[\s\S]*?\n  \};/);
if (!definedTerm) fail('/methodology: DefinedTerm JSON-LD not found');
else if (!definedTerm[0].includes('CONTRAST')) fail('/methodology: the DefinedTerm description does not carry the contrast, only the term name');

// --- 3. The worked example is computed, not transcribed ----------------------
if (!page.includes('budgetReality(EXAMPLE_PLAN)')) fail('/methodology: the worked example no longer calls budgetReality, so it can drift from the shipped planner');
if (!page.includes('data-testid="methodology-worked-example"')) fail('/methodology: the worked example is not addressable, so the browser proof cannot read it');
if (!/from '@\/data\/planning'/.test(page)) fail('/methodology: does not import from data/planning, so nothing links the claim to the code');

// --- 4. The stated behaviour matches what budgetReality actually returns ------
// The page describes three things Step 3 does. Each must correspond to a branch
// that really exists in budgetReality, or the description is fiction.
const claimedBehaviours = [
  { claim: 'flags the per-guest figure as insufficient', evidence: /budget per guest is tight/ },
  { claim: 'names the protected priorities to leave alone', evidence: /do not cut \$\{protectedItems\.join/ },
  { claim: 'names where the cutting starts instead', evidence: /Start savings with/ }
];
if (claimedBehaviours.length === 0) fail('examined 0 claimed behaviours');
for (const { claim, evidence } of claimedBehaviours) {
  if (!evidence.test(planning)) fail(`/methodology claims Step 3 ${claim}, but no such branch exists in data/planning.ts budgetReality`);
}

// The page must NOT claim the tool produces a revised budget or an affordability
// verdict. It does neither, and both are the easy overclaim to slip back in.
const overclaims = [
  { pattern: /tradeoff engine computes/i, why: 'budgetReality orders cuts; it computes no tradeoff' },
  { pattern: /tells you (?:exactly )?how much to cut/i, why: 'no figure to cut is ever produced' },
  { pattern: /(?:will|can) make (?:it|the number) (?:work|fit)/i, why: 'the tool explicitly does not claim the number works' },
  { pattern: /recalculates? your budget/i, why: 'no budget is recalculated' }
];
for (const { pattern, why } of overclaims) {
  if (pattern.test(page)) fail(`/methodology overclaims ("${pattern.source}"): ${why}`);
}

// --- 5. Contrast with a category, never a named competitor -------------------
const competitors = ['The Knot', 'Zola', 'WeddingWire', 'Minted', 'Martha Stewart', 'Brides.com', 'Hitched', 'Bridebook'];
const surfaces = ['app/methodology/page.tsx', 'app/readiness-score/page.tsx', 'data/planner-landings.ts', 'components/PlannerLandingPage.tsx', 'app/free-wedding-planner/page.tsx'];
if (surfaces.length === 0) fail('examined 0 published surfaces');
let scanned = 0;
for (const file of surfaces) {
  if (!fs.existsSync(path.join(ROOT, file))) { fail(`surface ${file} is missing`); continue; }
  scanned += 1;
  const text = read(file);
  for (const name of competitors) {
    if (text.includes(name)) fail(`${file}: names a competitor ("${name}"). The contrast must be with the category, which is defensible and quotable; a named comparison is neither.`);
  }
}
if (scanned === 0) fail('examined 0 surfaces for competitor naming');

console.log(`methodology contrast: contrast_defs=${contrastMatches.length} behaviours=${claimedBehaviours.length} surfaces_scanned=${scanned}`);
if (failures.length) {
  for (const message of failures) console.error(`  FAIL ${message}`);
  console.error(`methodology contrast: FAIL (${failures.length} problem(s))`);
  process.exit(1);
}
console.log(`methodology contrast: PASS (contrast stated once and carried into JSON-LD, ${claimedBehaviours.length} claimed behaviours all backed by a real branch in budgetReality, ${scanned} surfaces clean of named competitors)`);
