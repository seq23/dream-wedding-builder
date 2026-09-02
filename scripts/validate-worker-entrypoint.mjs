#!/usr/bin/env node
// GUARD: nothing can publish this site without first building the worker it
// publishes.
//
// wrangler.jsonc points `main` at .open-next/worker.js. That file is produced by
// `opennextjs-cloudflare build` and by nothing else - `next build` does not make
// it. So any script that uploads or deploys without building first is a deploy
// that cannot work on a clean checkout.
//
// It does not fail locally, ever. .open-next is gitignored but it is still SITTING
// THERE on any machine that has run preview or deploy once, so the entry point is
// found and everything looks fine. Only a clean CI checkout exposes it, which is
// how it reached production configuration unnoticed on 2026-09-01.
//
// The two commands Workers Builds actually runs live in the Cloudflare dashboard,
// outside this repo and outside code review. This validator cannot read them. What
// it can do is (a) enforce the invariant for every script in this repo, and (b)
// hold the dashboard values recorded in docs/runbooks/deployment.md to the same
// rule, so the documented configuration is at least self-consistent and a drift is
// a reviewable diff rather than a silent click.
//
// Rule 0: zero scripts examined is a failure, not a pass.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const failures = [];
const fail = (message) => failures.push(message);

const pkg = JSON.parse(read('package.json'));
const scripts = pkg.scripts ?? {};

// wrangler.jsonc has comments; strip them before parsing.
const wrangler = JSON.parse(read('wrangler.jsonc').replace(/^\s*\/\/.*$/gm, ''));
const entryPoint = wrangler.main;
if (!entryPoint) fail('wrangler.jsonc: no "main" entry point declared');

const WORKER_BUILD = 'opennextjs-cloudflare build';
// Anything that ships bytes to Cloudflare.
const PUBLISHERS = [
  /opennextjs-cloudflare\s+(deploy|upload|preview)/,
  /wrangler\s+deploy/,
  /wrangler\s+versions\s+upload/
];

const producers = Object.entries(scripts).filter(([, cmd]) => cmd.includes(WORKER_BUILD)).map(([name]) => name);
if (producers.length === 0) fail(`no npm script runs "${WORKER_BUILD}", so nothing in this repo can produce ${entryPoint}`);

// --- 1. Every publishing script builds the worker first ----------------------
const publishing = Object.entries(scripts).filter(([, cmd]) => PUBLISHERS.some((rx) => rx.test(cmd)));
if (publishing.length === 0) fail('examined 0 publishing scripts - either the deploy scripts are gone or this guard has stopped matching them');
for (const [name, cmd] of publishing) {
  const buildAt = cmd.indexOf(WORKER_BUILD);
  const publishAt = Math.min(...PUBLISHERS.map((rx) => { const m = rx.exec(cmd); return m ? m.index : Number.MAX_SAFE_INTEGER; }));
  if (buildAt === -1) fail(`script "${name}" publishes without running "${WORKER_BUILD}" first, so ${entryPoint} will not exist on a clean checkout`);
  else if (buildAt > publishAt) fail(`script "${name}" runs "${WORKER_BUILD}" after it publishes`);
}

// --- 2. `build` must not be mistaken for a worker build ----------------------
// This is the assumption that caused the incident. It is recorded as an assertion
// so that if someone later makes `build` produce the worker, they are forced to
// come here and update the runbook table rather than leaving it stale.
const buildScript = scripts.build ?? '';
if (buildScript && buildScript.includes(WORKER_BUILD)) {
  fail('"build" now runs the worker build. That is a valid choice, but @opennextjs/aws invokes "npm run build" itself, so this recurses unless open-next.config.ts sets buildCommand. Update docs/runbooks/deployment.md and this check together.');
}

// --- 3. The recorded dashboard configuration obeys the same rule -------------
const runbook = read('docs/runbooks/deployment.md');
const row = (label) => {
  const match = runbook.match(new RegExp(`\\|\\s*${label}\\s*\\|\\s*\`([^\`]+)\`\\s*\\|`));
  return match ? match[1].trim() : null;
};
const recorded = { build: row('Build command'), deploy: row('Deploy command') };
const recordedCount = Object.values(recorded).filter(Boolean).length;
if (recordedCount === 0) fail('docs/runbooks/deployment.md: the Workers Builds command table is missing, so the dashboard configuration is unrecorded and undiffable');
for (const [label, value] of Object.entries(recorded)) {
  if (!value) { fail(`docs/runbooks/deployment.md: no "${label} command" recorded`); continue; }
  const scriptName = value.startsWith('npm run ') ? value.slice('npm run '.length).trim() : null;
  if (!scriptName) fail(`recorded ${label} command "${value}" is not an npm script. Deploy behaviour must live in package.json where it is code-reviewed, not in a dashboard field.`);
  else if (!scripts[scriptName]) fail(`recorded ${label} command runs "${scriptName}", which is not a script in package.json`);
  else if (label === 'deploy' && !scripts[scriptName].includes(WORKER_BUILD)) {
    fail(`recorded deploy command "${value}" does not run "${WORKER_BUILD}", so the deploy stage cannot find ${entryPoint}`);
  }
}

console.log(`worker entrypoint: entry_point=${entryPoint} producers=${producers.length} publishing_scripts=${publishing.length} recorded_commands=${recordedCount}`);
if (failures.length) {
  for (const message of failures) console.error(`  FAIL ${message}`);
  console.error(`worker entrypoint: FAIL (${failures.length} problem(s))`);
  process.exit(1);
}
console.log(`worker entrypoint: PASS (${publishing.length} publishing scripts all build ${entryPoint} first; recorded dashboard commands consistent)`);
