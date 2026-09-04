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
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyRepair, classifyAttempt, shouldRetry, explain,
  REPAIRED, FAILED, NO_OP,
} from './repair_status.mjs';

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
// Prose is not a command. `manual_repair` carries the human instruction for a
// defect no script can fix; it is printed, never executed.
//
// Until 2026-09-03 both lived in `repair_command`, and eight of the thirteen
// entries were English sentences. This loop shells out whatever it finds there,
// so it ran them: "restore the working-files block in app/..." exits 127, and
// "add the route's label to lib/site-directory.ts (or a hub/landing record) ..."
// exits 2 because bash never finds the closing quote of "route's". Either way the
// loop called it a failed repair, retried the identical tree twice more, and
// exited 1 - so the daily authority lane reported "repair FAILED (exit 2)" three
// times and never once printed the sentence a human could have acted on. Keeping
// the two apart is what makes NO_REPAIR_AVAILABLE reachable for these validators.
const manualFor = new Map(validators.filter((v) => v.manual_repair).map((v) => [v.id, v.manual_repair]));

// A repair_command is executed verbatim, so it has to be a command. This does not
// try to judge whether the repair is correct - validate_repair_contract.mjs does
// that, at rest, for the whole registry. This is the runtime backstop that stops
// this loop from ever again shelling out a sentence: an unrunnable repair is a
// registry defect, and reporting it as one beats burning three attempts on it.
const executable = (cmd) => {
  if (spawnSync('bash', ['-n', '-c', cmd], { encoding: 'utf8' }).status !== 0) return false;
  const heads = cmd.split(/&&|\|\||;/).map((part) => part.trim()).filter(Boolean);
  if (!heads.length) return false;
  return heads.every((part) => {
    const m = part.match(/^npm run (?:--silent )?([\w:-]+)/);
    if (m) return Boolean(pkg.scripts?.[m[1]]);
    const n = part.match(/^node (\S+)/);
    if (n) return fs.existsSync(path.join(ROOT, n[1]));
    return false;
  });
};

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

// Did this command change anything? Progress is measured against the tree, never
// against an exit code, because a repair that exits 0 having touched no file
// leaves the next validation pass byte-identical - Rule 0 at the granularity of
// one command. Only the paths git already reports as changed are hashed, so this
// stays bounded no matter how large the checkout is; HEAD is included because a
// repair is allowed to commit.
const git = (...args) => spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function treeFingerprint() {
  const head = git('rev-parse', 'HEAD');
  const status = git('status', '--porcelain=v1', '-uall', '--no-renames');
  if (head.status !== 0 || status.status !== 0) {
    // Not an environment this loop can tell the truth in. Say so and stop rather
    // than falling back to "assume it worked" - that fallback is the defect.
    console.error('[self-heal] cannot read the git working tree, so a repair cannot be proved to have repaired anything.');
    console.error(`  git rev-parse HEAD -> ${(head.stderr || '').trim()}`);
    console.error(`  git status -> ${(status.stderr || '').trim()}`);
    process.exit(2);
  }
  const paths = (status.stdout || '').split('\n').filter(Boolean).map((l) => l.slice(3).trim()).filter(Boolean);
  const parts = [`HEAD ${(head.stdout || '').trim()}`, status.stdout || ''];
  for (const rel of paths.sort()) {
    const abs = path.join(ROOT, rel);
    let h = 'absent';
    try {
      if (fs.statSync(abs).isFile()) {
        const o = git('hash-object', '--', rel);
        h = o.status === 0 ? (o.stdout || '').trim() : 'unhashable';
      } else h = 'dir';
    } catch { h = 'absent'; }
    parts.push(`${rel} ${h}`);
  }
  return createHash('sha256').update(parts.join('\n')).digest('hex');
}

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
  // A registered repair that cannot run is not a repair. Sorting it here rather
  // than at the spawn keeps it out of `repairable`, so it can neither consume an
  // attempt nor make the loop look like it tried something.
  const unrunnable = failedIds.filter((id) => repairFor.has(id) && !executable(repairFor.get(id)));
  const repairable = failedIds.filter((id) => repairFor.has(id) && !unrunnable.includes(id));
  const unrepairable = failedIds.filter((id) => !repairable.includes(id));
  console.log(`[self-heal] attempt ${attempt}: ${blocking.length} blocking, ${warnings.length} warning (${repairable.length} repairable)`);
  for (const id of unrepairable) {
    if (manualFor.has(id)) console.log(`  no automated repair: ${id} - fix by hand: ${manualFor.get(id)}`);
    else if (unrunnable.includes(id)) console.error(`  registry defect: ${id} declares a repair_command that is not runnable: ${repairFor.get(id)}`);
    else console.log(`  no registered repair: ${id}`);
  }

  if (!repairable.length) {
    // Nothing would change, so another pass would fail identically. Stop and say
    // so rather than burning attempts to reach the same place.
    attempts.push({
      attempt, failed: failedIds, warnings: warnings.map((w) => w.id), repaired: [],
      manual: Object.fromEntries(failedIds.filter((id) => manualFor.has(id)).map((id) => [id, manualFor.get(id)])),
      unrunnable_repairs: Object.fromEntries(unrunnable.map((id) => [id, repairFor.get(id)])),
      result: 'NO_REPAIR_AVAILABLE',
    });
    break;
  }

  const repaired = [];
  for (const id of repairable) {
    const cmd = repairFor.get(id);
    if (DRY) {
      console.log(`  would repair ${id}: ${cmd}`);
      repaired.push({ id, cmd, code: null, changed: null, outcome: classifyRepair({ dry: true }), dry: true });
      continue;
    }
    console.log(`  repairing ${id}: ${cmd}`);
    const before = treeFingerprint();
    const r = run(cmd);
    const changed = r.code === 0 ? treeFingerprint() !== before : null;
    const outcome = classifyRepair({ code: r.code, changed: changed === null ? undefined : changed });
    if (outcome === FAILED) console.log(`  repair FAILED for ${id} (exit ${r.code}) - not counted as a repair`);
    else if (outcome === NO_OP) console.log(`  repair for ${id} exited 0 but changed no file - not counted as a repair`);
    else console.log(`  repaired ${id}`);
    repaired.push({ id, cmd, code: r.code, changed, outcome });
  }
  // Derived, never asserted. The literal that used to sit here said
  // REPAIRED_RETRYING no matter what the repairs did.
  const result = classifyAttempt(repaired.map((x) => x.outcome));
  console.log(`  attempt ${attempt}: ${result} - ${explain(result, repairable)}`);
  attempts.push({
    attempt, failed: failedIds, warnings: warnings.map((w) => w.id), repaired,
    manual: Object.fromEntries(failedIds.filter((id) => manualFor.has(id)).map((id) => [id, manualFor.get(id)])),
    unrunnable_repairs: Object.fromEntries(unrunnable.map((id) => [id, repairFor.get(id)])),
    result,
    reason: explain(result, repairable),
  });
  if (DRY) break;
  // An unchanged tree revalidates identically, so a further attempt is not a
  // retry, it is the same run again. Stop and report the real failure mode
  // instead of burning the remaining attempts to arrive back here.
  if (!shouldRetry(result)) {
    console.error(`[self-heal] stopping after attempt ${attempt}: ${explain(result, repairable)}`);
    break;
  }
}

const report = {
  schema_version: '1.0',
  generated_at: new Date().toISOString(),
  max_attempts: MAX,
  dry_run: DRY,
  gate_command: 'npm run validate:all',
  gate_exit_code: gate ? gate.code : null,
  registered_repairs: Object.fromEntries(repairFor),
  manual_repairs: Object.fromEntries(manualFor),
  status: clean ? 'CLEAN' : 'NOT_CLEAN',
  safe_to_push: clean,
  attempts,
};
fs.mkdirSync(path.join(ROOT, 'reports/validation'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports/validation/self-heal-loop.json'), `${JSON.stringify(report, null, 2)}\n`);

// A dry run is a report, not a verdict. It deliberately performs no repair, so
// "not clean" is its expected output whenever there is anything to do - and
// exiting non-zero for that made .github/workflows/self-heal.yml unable to heal
// anything at all: its "Report what the loop would repair" step runs before
// "Apply bounded repairs" under `bash -e`, so the moment a repairable failure
// existed the dry step failed the job and the real repair never ran. Proved on
// 2026-08-29 by deleting data/authority_scale/query_atlas.json: `selfheal:dry`
// exited 1 with "would repair query-atlas", while `selfheal` on the same tree
// repaired it and exited 0. The repair path was unreachable in exactly the case
// it exists for, and a no-op in every other.
//
// The dry run still fails loudly for what is a real failure of the run itself -
// the gate contradicting the attributed checks - because that is not "work is
// pending", it is "this loop cannot be trusted".
if (DRY) {
  console.log(`[self-heal] dry run complete: ${clean ? 'nothing to repair' : `status=${report.status}`} - see reports/validation/self-heal-loop.json`);
  for (const a of attempts) {
    if (a.result === 'NO_REPAIR_AVAILABLE') console.log(`  would NOT be repairable: ${a.failed.join(', ')} - no repair_command registered`);
  }
  if (attempts.some((a) => a.result === 'GATE_DISAGREES')) {
    console.error('[self-heal] dry run: validate:all disagrees with the attributed checks - the loop cannot be trusted until that is resolved.');
    process.exit(1);
  }
  process.exit(0);
}

if (!clean) {
  console.error(`[self-heal] NOT CLEAN after ${attempts.length} attempt(s) - refusing to declare the tree publishable.`);
  console.error('  see reports/validation/self-heal-loop.json');
  process.exit(1);
}
console.log('[self-heal] safe to push');
