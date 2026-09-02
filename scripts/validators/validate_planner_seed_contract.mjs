#!/usr/bin/env node
// GUARD: every landing page's and every guide's seed parameter hydrates into the
// plan, never overwrites saved work, and silently no-ops when malformed.
//
// This one does not inspect source. It RUNS the seeding logic against every
// landing seed and every shipping guide seed, because "the link contains a query
// string" is not the claim being made - the claim is that following the link
// changes the plan. Only execution can prove that.
//
// Rule 0: if the spec reports zero tests, this fails. A guard that passes because
// the test file was deleted is worse than no guard.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SPEC = 'tests/unit/planner-seed.test.ts';

if (!fs.existsSync(path.join(ROOT, SPEC))) {
  console.error(`planner seed contract: FAIL - ${SPEC} does not exist, so nothing proves a seed hydrates`);
  process.exit(1);
}

const run = spawnSync('npx', ['vitest', 'run', SPEC, '--reporter=json'], { encoding: 'utf8', env: process.env });
const stdout = run.stdout ?? '';
const json = stdout.slice(stdout.indexOf('{'));

let report;
try { report = JSON.parse(json); }
catch {
  console.error('planner seed contract: FAIL - could not read the spec result');
  console.error(`${stdout}\n${run.stderr ?? ''}`.trim().split('\n').slice(-15).join('\n'));
  process.exit(1);
}

const total = report.numTotalTests ?? 0;
const passed = report.numPassedTests ?? 0;
const failed = report.numFailedTests ?? 0;

console.log(`planner seed contract: tests=${total} passed=${passed} failed=${failed}`);

if (total === 0) {
  console.error('planner seed contract: FAIL - examined 0 seeds. The spec ran but asserted nothing.');
  process.exit(1);
}
if (failed > 0 || (run.status ?? 1) !== 0) {
  for (const suite of report.testResults ?? []) {
    for (const test of suite.assertionResults ?? []) {
      if (test.status === 'failed') console.error(`  FAIL ${test.fullName}: ${(test.failureMessages ?? []).join(' ').split('\n')[0]}`);
    }
  }
  console.error(`planner seed contract: FAIL (${failed} failing assertion(s))`);
  process.exit(1);
}
console.log(`planner seed contract: PASS (${passed} seed assertions across every landing page and every shipping guide)`);
