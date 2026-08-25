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
