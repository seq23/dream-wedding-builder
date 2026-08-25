#!/usr/bin/env node
// Validate -> repair -> re-validate, until clean or out of attempts.
//
// This repo already had every piece of a self-healing release except the wiring.
// _repo_validation_registry.json knows which checks block a release, and
// package.json carries real repair scripts (atlas:build, authority:flow,
// search:repair) - but nothing connected a failing validator to the repair that
// fixes exactly the defect it detects. A stale admission report or a hub missing
// its meta description stopped the release and waited for a human, even though
// the command that fixes it was sitting one line away in package.json.
//
//   node scripts/selfheal/heal_until_clean.mjs [--max 3] [--dry-run]
//
// Exit 0 means `npm run validate:all` is green and no HARD_FAIL registry
// validator is failing - i.e. it is safe to push. Non-zero means it is not, and
// the report names what could not be healed and why.
//
// Validation purity is preserved on purpose. scripts/validate-*.mjs may not
// mutate files and no `validate:*` script may invoke a build (both are enforced
// by validate:profile-purity). Repairs therefore live here, in a lane that is
// explicitly allowed to mutate, and never inside a validator.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const MAX = Math.max(1, Math.min(5, Number(arg('--max', '3')) || 3));
const DRY = argv.includes('--dry-run');

const readJson = (rel, fallback) => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return fallback; }
};

const pkg = readJson('package.json', { scripts: {} });
const registry = readJson('_repo_validation_registry.json', { validators: [] });
const validators = (registry.validators || []).filter((v) => !v.composite);
const byId = new Map(validators.map((v) => [v.id, v]));
const repairFor = new Map(validators.filter((v) => v.repair_command).map((v) => [v.id, v.repair_command]));

// Which npm scripts does the repo's own release gate actually reach? Derived from
// package.json rather than hard-coded, so a change to validate:all cannot quietly
// leave this loop calling something green that the gate calls red.
function reachedBy(scriptName, seen = new Set()) {
  if (seen.has(scriptName)) return seen;
  seen.add(scriptName);
  const body = pkg.scripts?.[scriptName];
  if (!body) return seen;
  for (const m of body.matchAll(/npm run (?:--silent )?([\w:-]+)/g)) reachedBy(m[1], seen);
  return seen;
}
const GATE_SCRIPTS = reachedBy('validate:all');

// A failure blocks the push if the repo's own gate would stop on it, or if the
// registry classifies it HARD_FAIL ("blocks the release"). Everything else is a
// warning by the registry's own severity contract and is reported, not enforced.
const isBlocking = (v) => v.severity === 'HARD_FAIL' || GATE_SCRIPTS.has(v.npmScript);

const run = (cmd) => {
  const started = Date.now();
  const r = spawnSync(cmd, {
    cwd: ROOT, shell: true, encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=3072' },
  });
  return { cmd, code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`, ms: Date.now() - started };
};

// typecheck and test are members of validate:all but are not registry validators,
// so they are run as named phases - otherwise a TypeScript error would surface as
// an unattributed "validate:all failed" with nothing to name.
const PHASES = [
  { id: 'typecheck', cmd: 'npm run --silent typecheck' },
  { id: 'test', cmd: 'npm run --silent test' },
];

// run-registry.mjs exits non-zero only on HARD_FAIL, so its exit code cannot be
// used to detect warning-severity failures - several of which validate:all does
// block on. Read its machine-readable results instead.
function registryFailures() {
  const doc = readJson('reports/validation/registry-run.json', null);
  if (!doc) return null;
  return (doc.results || []).filter((r) => !r.ok).map((r) => r.id);
}

function validate() {
  const failures = [];
  for (const phase of PHASES) {
    const r = run(phase.cmd);
    if (r.code !== 0) failures.push({ id: phase.id, blocking: true, source: 'validate:all phase' });
  }
  const reg = run('npm run --silent validate:registry');
  const ids = registryFailures();
  if (ids === null) {
    failures.push({ id: 'validate:registry', blocking: true, source: 'registry run produced no report', code: reg.code });
  } else {
    for (const id of ids) {
      const v = byId.get(id) || { id, severity: 'UNKNOWN', npmScript: id };
      failures.push({ id, blocking: isBlocking(v), severity: v.severity, npmScript: v.npmScript, source: 'registry' });
    }
  }
  return failures;
}

const attempts = [];
let clean = false;
let gate = null;

for (let attempt = 1; attempt <= MAX; attempt += 1) {
  const failures = validate();
  const blocking = failures.filter((f) => f.blocking);
  const warnings = failures.filter((f) => !f.blocking);

  if (!blocking.length) {
    // Confirm against the repo's own gate rather than inferring it from the
    // phases above. "Safe to push" has to mean the command the repo actually
    // uses came back green.
    gate = run('npm run validate:all');
    if (gate.code === 0) {
      attempts.push({ attempt, failed: [], warnings: warnings.map((w) => w.id), repaired: [], result: 'CLEAN' });
      clean = true;
      console.log(`[self-heal] clean on attempt ${attempt}`);
      for (const w of warnings) console.log(`  non-blocking warning: ${w.id} (${w.severity})`);
      break;
    }
    // The gate disagrees with the attributed phases. That is a real inconsistency
    // and must not be healed away silently.
    console.error('[self-heal] validate:all failed while every attributed check passed');
    console.error(gate.out.trim().split('\n').slice(-15).join('\n'));
    attempts.push({ attempt, failed: ['validate:all'], warnings: warnings.map((w) => w.id), repaired: [], result: 'GATE_DISAGREES' });
    break;
  }

  const failedIds = failures.map((f) => f.id);
  const repairable = failedIds.filter((id) => repairFor.has(id));
  const unrepairable = failedIds.filter((id) => !repairFor.has(id));
  console.log(`[self-heal] attempt ${attempt}: ${blocking.length} blocking, ${warnings.length} warning (${repairable.length} repairable)`);
  for (const id of unrepairable) console.log(`  no registered repair: ${id}`);

  if (!repairable.length) {
    // Nothing would change, so another pass would fail identically. Stop and say
    // so rather than burning attempts to reach the same place.
    attempts.push({ attempt, failed: failedIds, warnings: warnings.map((w) => w.id), repaired: [], result: 'NO_REPAIR_AVAILABLE' });
    break;
  }

  const repaired = [];
  for (const id of repairable) {
    const cmd = repairFor.get(id);
    if (DRY) { console.log(`  would repair ${id}: ${cmd}`); repaired.push({ id, cmd, code: 0, dry: true }); continue; }
    console.log(`  repairing ${id}: ${cmd}`);
    const r = run(cmd);
    if (r.code !== 0) console.log(`  repair FAILED for ${id} (exit ${r.code})`);
    repaired.push({ id, cmd, code: r.code });
  }
  attempts.push({ attempt, failed: failedIds, warnings: warnings.map((w) => w.id), repaired, result: 'REPAIRED_RETRYING' });
  if (DRY) break;
}

const report = {
  schema_version: '1.0',
  generated_at: new Date().toISOString(),
  max_attempts: MAX,
  dry_run: DRY,
  gate_command: 'npm run validate:all',
  gate_exit_code: gate ? gate.code : null,
  registered_repairs: Object.fromEntries(repairFor),
  status: clean ? 'CLEAN' : 'NOT_CLEAN',
  safe_to_push: clean,
  attempts,
};
fs.mkdirSync(path.join(ROOT, 'reports/validation'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports/validation/self-heal-loop.json'), `${JSON.stringify(report, null, 2)}\n`);

if (!clean) {
  console.error(`[self-heal] NOT CLEAN after ${attempts.length} attempt(s) - refusing to declare the tree publishable.`);
  console.error('  see reports/validation/self-heal-loop.json');
  process.exit(1);
}
console.log('[self-heal] safe to push');
