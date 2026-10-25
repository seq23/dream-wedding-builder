#!/usr/bin/env node
// Registry-driven validation with real severity.
//
// A registry that nothing reads is documentation. This runner is what makes the
// HARD_FAIL / WARNING split mean something: warnings are reported prominently and
// do not block, so a hygiene check can never again strand a release the way a
// frozen page count or a zero-rejection rule did.
//
// Exit code is non-zero only when a HARD_FAIL validator fails.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, '_repo_validation_registry.json'), 'utf8'));
const only = process.argv.includes('--hard-fail-only');

// The registry declares a `counts` block and also carries the list those counts
// describe. Nothing connected the two, so adding selfheal-status-contract on
// 2026-09-03 left the header saying 30 HARD_FAILs above a list of 31 and every
// gate stayed green - the "two components each keeping their own list with no
// link between them" defect this repo keeps rediscovering, in the file that
// exists to prevent it. The runner owns this file, so it asserts it here, before
// spawning anything: a stale header is a registry that cannot be trusted to say
// what it enforces.
//
// Rule 0: an empty validator list is a hard failure, not a clean run of nothing.
{
  const all = registry.validators || [];
  if (all.length === 0) {
    console.error('[validate:registry] the registry declares zero validators. A run that validated nothing has not passed.');
    process.exit(1);
  }
  const actual = {};
  for (const v of all) actual[v.severity] = (actual[v.severity] || 0) + 1;
  const declared = registry.counts || {};
  const keys = [...new Set([...Object.keys(declared), ...Object.keys(actual)])].sort();
  const drift = keys.filter((k) => (declared[k] || 0) !== (actual[k] || 0));
  if (!Object.keys(declared).length) {
    console.error('[validate:registry] the registry has no `counts` block to check the validator list against.');
    process.exit(1);
  }
  if (drift.length) {
    for (const k of drift) console.error(`[validate:registry] counts.${k} declares ${declared[k] || 0} but the validator list holds ${actual[k] || 0}`);
    console.error('[validate:registry] BLOCKING: _repo_validation_registry.json counts disagree with its own validator list. Update counts so the header states what the registry actually enforces.');
    process.exit(1);
  }
}

// The post-deploy lane. These checks fetch the live hosts, so they cannot be
// pre-merge gates: on a pull request the fix under review is not deployed yet, and
// gating the merge on production state would red every PR that fixes production.
// They run once per deploy, from a workflow. What this gate owns is the other half
// of the defect class: a check that exists and nothing invokes. Each declared entry
// must name an npm script that exists and a workflow file that runs it.
{
  const declared = registry.post_deploy_checks || [];
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const problems = [];
  for (const c of declared) {
    if (!c.npmScript || !pkg.scripts?.[c.npmScript]) { problems.push(`post_deploy_checks.${c.id} names npm script ${c.npmScript}, which package.json does not define`); continue; }
    const wf = path.join(ROOT, c.workflow || '');
    if (!c.workflow || !fs.existsSync(wf)) { problems.push(`post_deploy_checks.${c.id} names workflow ${c.workflow}, which does not exist`); continue; }
    const text = fs.readFileSync(wf, 'utf8');
    if (!text.includes(c.npmScript) && !text.includes(c.command || '\u0000')) problems.push(`${c.workflow} never runs ${c.npmScript}: the post-deploy check exists and nothing invokes it`);
  }
  if (problems.length) {
    for (const m of problems) console.error(`[validate:registry] ${m}`);
    console.error('[validate:registry] BLOCKING: a declared post-deploy check is inert.');
    process.exit(1);
  }
  if (declared.length) console.log(`[validate:registry] post-deploy lane: ${declared.map((c) => c.npmScript).join(', ')} (run by workflow, not by this gate)`);
}

const results = [];
for (const v of registry.validators) {
  // Composites re-run their members; skip them so a failure is attributed to the
  // specific check rather than counted twice under a wrapper.
  if (v.composite) continue;
  if (only && v.severity !== 'HARD_FAIL') continue;
  const started = Date.now();
  const r = spawnSync('npm', ['run', '--silent', v.npmScript], { encoding: 'utf8', env: process.env });
  const ok = (r.status ?? 1) === 0;
  results.push({ ...v, ok, ms: Date.now() - started, output: ok ? '' : `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').slice(-6).join('\n') });
}

const failedHard = results.filter((r) => !r.ok && r.severity === 'HARD_FAIL');
const warned = results.filter((r) => !r.ok && r.severity !== 'HARD_FAIL');
const passed = results.filter((r) => r.ok);

for (const r of failedHard) {
  console.error(`\n[HARD FAIL] ${r.npmScript} - ${r.reason}`);
  if (r.output) console.error(r.output.split('\n').map((l) => `    ${l}`).join('\n'));
}
for (const r of warned) {
  console.warn(`\n[${r.severity}] ${r.npmScript} - ${r.reason} (non-blocking)`);
}

const out = path.join(ROOT, 'reports/validation');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'registry-run.json'), JSON.stringify({
  generated_at: new Date().toISOString(),
  passed: passed.length, hard_failed: failedHard.length, warned: warned.length,
  results: results.map(({ output, ...rest }) => rest),
}, null, 2) + '\n');

console.log(`\n[validate:registry] passed=${passed.length} hard_failed=${failedHard.length} warned=${warned.length}`);
if (failedHard.length) {
  console.error(`[validate:registry] BLOCKING: ${failedHard.map((r) => r.npmScript).join(', ')}`);
  process.exit(1);
}
if (warned.length) console.log(`[validate:registry] non-blocking warnings: ${warned.map((r) => r.npmScript).join(', ')}`);
