#!/usr/bin/env node
/**
 * GUARD: the self-heal repair contract, and the lanes that reach a gate needing a build.
 *
 * Written against a reproduced defect, not a hypothetical. On 2026-09-03 the
 * scheduled "Full Safe Autonomy" lane failed for two reasons that compound, and
 * this validator asserts against both.
 *
 * 1. A repair_command must be a command.
 *
 *    scripts/selfheal/heal_until_clean.mjs executes repair_command verbatim
 *    through a shell. Eight of the registry's thirteen were English sentences
 *    written for a human. Five happened to be valid shell and exited 127
 *    ("restore: command not found"); internal-link-graph's died with exit 2
 *    because bash never found the closing quote of "route's". The loop reported
 *    "repair FAILED", retried an unchanged tree twice more, and exited 1 - so the
 *    log said a repair had failed when no repair had ever been attempted, and the
 *    human instruction sitting in that same field was never printed. Prose now
 *    lives in manual_repair, and this gate keeps the two apart in both directions.
 *
 * 2. A lane that runs a build-requiring gate must run the build.
 *
 *    internal-link-graph is `requires_build: true`: it boots the built app and
 *    crawls it, and hard-fails when .next is absent rather than passing on an
 *    empty crawl. PR #9 added it along with `npm run build` in ci.yml and
 *    self-heal.yml, and missed full-safe-autonomy.yml - the only other lane that
 *    reaches the registry, through `npm run selfheal`. Nothing connected the
 *    registry's requires_build flag to the workflows, so the field was a
 *    decoration and the miss was invisible until the cron went red every night.
 *
 * Reachability is derived, never listed. npm script bodies are expanded
 * transitively; a script that shells a node file has that file scanned one level
 * deep for `npm run` (this is how `selfheal` is known to reach validate:registry);
 * and any lane reaching run-registry.mjs reaches every non-composite validator in
 * the registry, because that runner spawns all of them. A hand-maintained list
 * here would be a second copy of the wiring with nothing tying it to the first -
 * the defect class this repo keeps rediscovering.
 *
 * Rule 0: it counts what it examined and hard-fails on zero - no repair commands,
 * no requires_build validators, or no workflows all mean this gate proved nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const WORKFLOW_DIR = '.github/workflows';
const errors = [];

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, '_repo_validation_registry.json'), 'utf8'));
const validators = (registry.validators || []).filter((v) => !v.composite);

// ---------------------------------------------------------------- part 1
// Is this string something a shell could actually run, and does what it names
// exist? Mirrors the check heal_until_clean.mjs applies at runtime; this is the
// at-rest copy that fails the build instead of failing the night.
const runnable = (cmd) => {
  if (spawnSync('bash', ['-n', '-c', cmd], { encoding: 'utf8' }).status !== 0) return false;
  const parts = cmd.split(/&&|\|\||;/).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return false;
  return parts.every((part) => {
    const m = part.match(/^npm run (?:--silent )?([\w:-]+)/);
    if (m) return Boolean(pkg.scripts?.[m[1]]);
    const n = part.match(/^node (\S+)/);
    if (n) return fs.existsSync(path.join(ROOT, n[1]));
    return false;
  });
};

const withRepair = validators.filter((v) => v.repair_command);
const withManual = validators.filter((v) => v.manual_repair);

for (const v of withRepair) {
  if (!runnable(v.repair_command)) {
    errors.push(`${v.id}: repair_command is not runnable, and the self-heal loop executes it verbatim - ${JSON.stringify(v.repair_command)}. If this is an instruction for a human, move it to manual_repair.`);
  }
}
for (const v of withManual) {
  if (runnable(v.manual_repair)) {
    errors.push(`${v.id}: manual_repair is a runnable command - ${JSON.stringify(v.manual_repair)}. If a script can fix this, it belongs in repair_command so the loop actually repairs it.`);
  }
  if (v.repair_command) {
    errors.push(`${v.id}: declares both repair_command and manual_repair. One defect, one repair path: the loop cannot report both "repaired" and "fix by hand" for the same failure.`);
  }
}
if (withRepair.length === 0 && withManual.length === 0) {
  errors.push('examined zero repair fields: either the registry lost them or this gate is reading the wrong file. A run that checked nothing has not passed.');
}

// ---------------------------------------------------------------- part 2
// Two different closures, because the two questions are different, and conflating
// them made the first version of this gate pass the very break it was written for.
//
// `scriptClosure` expands npm scripts through package.json only. That is what
// "does this lane build?" has to mean: a real invocation, never a mention.
//
// `reachClosure` additionally follows one level into any node file a script
// shells - which is how `selfheal` is known to reach validate:registry, and thus
// every non-composite validator, since run-registry.mjs spawns them all.
//
// The first draft used the file-scanning closure for both, and JS comments were
// not stripped. validate_internal_link_graph.mjs says "run `npm run build` before
// this gate" in a comment, so `npm run selfheal` appeared to reach `build`:
// deleting the build step from full-safe-autonomy.yml left this gate green.
// Proved 2026-09-03. Comments are stripped from JS for the same reason they are
// stripped from YAML below - a sentence describing a command is not the command.
const stripJs = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

const REGISTRY_RUNNER = /run-registry\.mjs/;
const allValidatorScripts = validators.map((v) => v.npmScript).filter(Boolean);

const scriptClosure = (name, seen = new Set()) => {
  if (seen.has(name)) return seen;
  seen.add(name);
  const body = pkg.scripts?.[name];
  if (!body) return seen;
  for (const m of body.matchAll(/npm run (?:--silent )?([\w:-]+)/g)) scriptClosure(m[1], seen);
  return seen;
};

const reachClosure = (name, seen = new Set()) => {
  if (seen.has(name)) return seen;
  seen.add(name);
  const body = pkg.scripts?.[name];
  if (!body) return seen;
  for (const m of body.matchAll(/npm run (?:--silent )?([\w:-]+)/g)) reachClosure(m[1], seen);
  for (const f of body.matchAll(/node (\S+\.m?js)/g)) {
    const file = path.join(ROOT, f[1]);
    if (!fs.existsSync(file)) continue;
    const src = stripJs(fs.readFileSync(file, 'utf8'));
    if (REGISTRY_RUNNER.test(f[1]) || REGISTRY_RUNNER.test(src)) {
      for (const sc of allValidatorScripts) reachClosure(sc, seen);
    }
    for (const m of src.matchAll(/npm run (?:--silent )?([\w:-]+)/g)) reachClosure(m[1], seen);
  }
  return seen;
};

const buildRequiring = validators.filter((v) => v.requires_build);
if (buildRequiring.length === 0) {
  errors.push('examined zero requires_build validators: this gate exists to keep a build-requiring check paired with a build, and found none to pair. If that flag was dropped, the pairing is unenforced.');
}

// Comment lines are dropped before matching. Several of these workflows explain
// themselves in prose that names the very commands being searched for, and a
// substring match on the raw file would credit a comment as an invocation - which
// is precisely how a lane could appear to build while never building.
const strip = (text) => text.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');

const workflowFiles = fs.existsSync(path.join(ROOT, WORKFLOW_DIR))
  ? fs.readdirSync(path.join(ROOT, WORKFLOW_DIR)).filter((f) => /\.ya?ml$/.test(f))
  : [];
if (workflowFiles.length === 0) {
  errors.push(`no workflows found in ${WORKFLOW_DIR} - cannot confirm any lane pairs a build with the gates that need one.`);
}

let lanesChecked = 0;
for (const file of workflowFiles) {
  const rel = `${WORKFLOW_DIR}/${file}`;
  const body = strip(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

  // Every npm script this lane invokes, with the offset it is invoked at, so
  // ordering is read from the file rather than assumed.
  const invocations = [...body.matchAll(/npm run (?:--silent )?([\w:-]+)/g)]
    .map((m) => ({ script: m[1], at: m.index }));
  if (!invocations.length) continue;

  const buildAt = Math.min(...invocations.filter((i) => scriptClosure(i.script).has('build')).map((i) => i.at), Infinity);

  for (const v of buildRequiring) {
    const reaching = invocations.filter((i) => reachClosure(i.script).has(v.npmScript));
    if (!reaching.length) continue;
    lanesChecked += 1;
    const gateAt = Math.min(...reaching.map((i) => i.at));
    const via = reaching.find((i) => i.at === gateAt).script;
    if (buildAt === Infinity) {
      errors.push(`${rel} reaches ${v.id} (${v.npmScript}) via \`npm run ${via}\` but never runs a build. ${v.id} declares requires_build and hard-fails without .next, so this lane can only ever fail - the exact defect that made the scheduled authority lane red every night from 2026-09-03.`);
    } else if (buildAt > gateAt) {
      errors.push(`${rel} runs \`npm run ${via}\` (which reaches ${v.id}) at offset ${gateAt}, before its build at offset ${buildAt}. A build after the gate is a build the gate never sees.`);
    }
  }
}
if (lanesChecked === 0 && buildRequiring.length > 0 && workflowFiles.length > 0) {
  errors.push(`no workflow reaches any of the ${buildRequiring.length} requires_build validator(s) (${buildRequiring.map((v) => v.id).join(', ')}). A gate no lane runs is not a gate.`);
}

// ---------------------------------------------------------------- verdict
console.log(`  repair_command examined=${withRepair.length} manual_repair examined=${withManual.length}`);
console.log(`  requires_build validators=${buildRequiring.length} workflow files=${workflowFiles.length} build-paired lanes=${lanesChecked}`);
if (errors.length) {
  for (const e of errors) console.error(`  FAIL ${e}`);
  console.error(`repair contract: FAIL (${errors.length} problem(s))`);
  process.exit(1);
}
console.log(`repair contract: PASS (${withRepair.length} runnable repair command(s), ${withManual.length} manual instruction(s), ${lanesChecked} build-paired lane(s))`);
