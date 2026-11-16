#!/usr/bin/env node
// Runs in .github/workflows/brand-social-metrics.yml AFTER push_back.sh, on the file
// that was just written and committed (data/brand-social/metrics.json).
//
// A metric that is unread because something BROKE (a refused Buffer key, a Buffer
// outage, no matching channel, a beacon that cannot record) is a NAMED STOP and exit 1,
// so the daily run is red the same day. A metric that waits on a key only the owner
// can mint, or on a host's first page loads, is a note: printed, exit 0. A key wait has
// a deadline: past MISSING_KEY_GRACE_DAYS (14) from its `missing_since` date it is a
// break too, so a key nobody sends cannot keep the scorecard row blank behind a green run. The data lands
// first either way, so the scorecard's 9-day staleness check never trips on a wait.
//
// Rule 0: a missing or unparseable file, a file the contract rejects, or zero metric
// fields examined is exit 1. This never exits 0 having checked nothing.
import fs from 'node:fs';
import path from 'node:path';
import { metricsProblems, unreadSummary } from './lib.mjs';

const file = path.join(process.argv[2] || '.', 'data/brand-social/metrics.json');
const TAG = '[brand-social:stop-check]';
const summaryOut = (lines) => {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Brand social stop check\n\n${lines.join('\n\n')}\n`);
};
const stop = (lines) => {
  for (const l of lines) console.error(l);
  summaryOut(lines);
  process.exit(1);
};

let metrics;
try { metrics = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) {
  stop([`NAMED STOP BRAND_SOCIAL_UNREADABLE: ${file} could not be read (${error.message})`]);
}
const result = unreadSummary(metrics);
const problems = [...result.problems, ...metricsProblems(metrics)];
if (result.checked === 0) problems.push('zero metric fields examined');
if (problems.length) stop(problems.map((p) => `NAMED STOP BRAND_SOCIAL_UNREADABLE: metrics.json ${p}`));

const notes = result.notes.map(({ field, reason }) => `${TAG} note: ${field} waits - ${reason}`);
const keys = result.missingKeys.map((name) => `Missing key: ${name}`);
if (result.breaks.length) {
  stop([...result.breaks.map(({ field, reason }) => `NAMED STOP BRAND_SOCIAL_UNREADABLE: ${field} - ${reason}`), ...notes, ...keys]);
}
const ok = `OUTPUT brand-social:stop-check: ${result.checked} field(s) examined, 0 broken, ${result.notes.length} waiting`;
console.log([...notes, ...keys, ok].join('\n'));
summaryOut([...notes, ...keys, ok]);
