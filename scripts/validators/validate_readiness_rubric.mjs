#!/usr/bin/env node
// GUARD: the published readiness rubric matches lib/readiness.ts.
//
// /readiness-score tells the world how the score works. If the page and the
// scorer drift, the site is publishing a false description of its own behaviour -
// a worse outcome than not publishing the rubric at all.
//
// The defence is structural rather than comparative: the page must RENDER FROM
// the module and must not restate any of it as literal prose. A page that imports
// the checks cannot describe them wrongly. A page that copies them can, and will.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const failures = [];
const fail = (message) => failures.push(message);

const module_ = read('lib/readiness.ts');
const page = read('app/readiness-score/page.tsx');
const planning = read('data/planning.ts');

// --- 1. Exactly one definition of the score ----------------------------------
const inlineFormula = /checks\.filter\(Boolean\)\.length \/ checks\.length/;
if (inlineFormula.test(planning)) fail('data/planning.ts: the readiness formula has been re-inlined; there are now two definitions');
if (!/export \{[^}]*derivePlanReadiness[^}]*\} from '@\/lib\/readiness'/.test(planning)) fail("data/planning.ts: no longer re-exports derivePlanReadiness from '@/lib/readiness'");

const formulaMatches = [...module_.matchAll(/satisfied \/ readinessChecks\.length/g)];
if (formulaMatches.length !== 1) fail(`lib/readiness.ts: expected exactly one score formula, found ${formulaMatches.length}`);

// --- 2. Every check is published --------------------------------------------
const checks = [...module_.matchAll(/^\s{4}id: '([^']+)',\n\s+\/\*\*[\s\S]*?\n\s{4}label: '([^']+)',/gm)]
  .map((match) => ({ id: match[1], label: match[2] }));
const labels = [...module_.matchAll(/^\s{4}label: '([^']+)'/gm)].map((match) => match[1]);
const ids = [...module_.matchAll(/^\s{4}id: '([^']+)'/gm)].map((match) => match[1]);
if (ids.length === 0) fail('lib/readiness.ts: examined 0 readiness checks - the rubric has nothing to describe');
if (labels.length !== ids.length) fail(`lib/readiness.ts: ${ids.length} check ids but ${labels.length} labels`);

// The page must iterate the checks, not list them.
if (!page.includes("from '@/lib/readiness'")) fail('readiness-score page: does not import lib/readiness');
for (const symbol of ['readinessChecks', 'readinessBands', 'READINESS_CHECK_COUNT', 'READINESS_POINTS_PER_CHECK']) {
  if (!page.includes(symbol)) fail(`readiness-score page: does not render ${symbol}, so that part of the rubric is unpublished or restated`);
}
if (!/readinessChecks\.map/.test(page)) fail('readiness-score page: does not iterate readinessChecks');
if (!/readinessBands\.map/.test(page)) fail('readiness-score page: does not iterate readinessBands');

// --- 3. Nothing from the module is duplicated as prose -----------------------
// This is the check that actually prevents drift: a literal copy of a label or a
// band name in the page is a second source of truth waiting to fall behind.
for (const label of labels) {
  if (page.includes(`'${label}'`) || page.includes(`>${label}<`)) fail(`readiness-score page: hardcodes the check label "${label}" instead of rendering it`);
}
const bandNames = [...module_.matchAll(/name: '([A-Z][a-z]+)', meaning:/g)].map((match) => match[1]);
if (bandNames.length === 0) fail('lib/readiness.ts: examined 0 readiness bands');
for (const name of bandNames) {
  if (new RegExp(`>\\s*${name}\\s*<`).test(page)) fail(`readiness-score page: hardcodes the band name "${name}" instead of rendering it`);
}

// --- 4. The stated weight is the real weight ---------------------------------
// The page prints a rounded per-check weight. If the check count changes and the
// page still claims the old figure, that is exactly the drift this guard exists
// to catch - so the page must compute it, never state it.
const literalWeights = [...page.matchAll(/(\d+)% (?:each|per check)/g)].map((match) => match[1]);
if (literalWeights.length) fail(`readiness-score page: states a literal per-check weight (${literalWeights.join(', ')}) rather than computing it from READINESS_POINTS_PER_CHECK`);

// The 11% claim is a real behaviour of the scorer - a new plan has budgetMode
// defaulted to 'unknown', which satisfies exactly one check. If that default ever
// changes, the published explanation becomes false.
const defaultsToUnknown = /budgetMode: 'unknown'/.test(read('data/planning.ts'));
const pageClaims11 = /11%/.test(page) || /11%/.test(module_);
if (pageClaims11 && !defaultsToUnknown) fail("the rubric explains an opening score of 11%, but emptyPlan.budgetMode no longer defaults to 'unknown' - the explanation is now false");
const expectedOpening = Math.round((1 / ids.length) * 100);
if (pageClaims11 && expectedOpening !== 11) fail(`the rubric explains an opening score of 11%, but ${ids.length} checks makes the real opening score ${expectedOpening}%`);

console.log(`readiness rubric: checks=${ids.length} bands=${bandNames.length} opening_score=${expectedOpening}%`);
if (failures.length) {
  for (const message of failures) console.error(`  FAIL ${message}`);
  console.error(`readiness rubric: FAIL (${failures.length} problem(s))`);
  process.exit(1);
}
console.log(`readiness rubric: PASS (${ids.length} checks and ${bandNames.length} bands published from lib/readiness.ts, none restated)`);
