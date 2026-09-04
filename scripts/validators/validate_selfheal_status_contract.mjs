#!/usr/bin/env node
/**
 * GUARD: a self-heal repair may not report success it did not achieve.
 *
 * Written against a reproduced defect, not a hypothetical. Scheduled run
 * 33744292112 ("Full Safe Autonomy", main, 2026-09-03) logged:
 *
 *     repair FAILED for internal-link-graph (exit 2)      x3
 *     attempt 1: REPAIRED_RETRYING failed=[internal-link-graph]
 *     attempt 2: REPAIRED_RETRYING failed=[internal-link-graph]
 *     attempt 3: REPAIRED_RETRYING failed=[internal-link-graph]
 *
 * heal_until_clean.mjs wrote `result: 'REPAIRED_RETRYING'` as a string literal
 * after the repair loop, unconditionally. A repair that had just exited 2 was
 * therefore recorded as having repaired something, all three attempts were spent
 * revalidating a tree no repair had touched, and the report named the wrong
 * failure mode to the human reading it the next morning.
 *
 * This gate asserts the mapping by executing it, not by describing it. Three
 * things have to hold, and each is checked against something that can break:
 *
 *   1. The contract itself. classifyRepair/classifyAttempt are run over a table
 *      of cases; a non-zero exit and a zero exit that changed no file must both
 *      be unable to produce REPAIRED or REPAIRED_RETRYING, and an unmeasured
 *      repair must throw rather than default to "it worked".
 *   2. The wiring. heal_until_clean.mjs must import the contract and must not
 *      hard-code an attempt result. A contract nothing calls is this repo's
 *      other recurring defect - two components each keeping their own copy with
 *      no link between them - and it is exactly how the original literal
 *      survived.
 *   3. The output. Every attempt in reports/validation/self-heal-loop.json that
 *      claims REPAIRED_RETRYING must carry a repair that actually repaired. That
 *      is the assertion that would have gone red on 33744292112's own artifact.
 *
 * Rule 0: it counts the cases, the wiring assertions and the report attempts it
 * examined, and hard-fails on zero cases or zero wiring assertions rather than
 * passing on an empty loop.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  classifyRepair, classifyAttempt, shouldRetry,
  REPAIRED, FAILED, NO_OP, DRY_RUN_SKIPPED,
  REPAIRED_RETRYING, REPAIR_FAILED, REPAIR_INEFFECTIVE, DRY_RUN,
} from '../selfheal/repair_status.mjs';

const ROOT = process.cwd();
const LOOP = 'scripts/selfheal/heal_until_clean.mjs';
const REPORT = 'reports/validation/self-heal-loop.json';
const errors = [];

// ---------------------------------------------------------------- 1. contract
// The exit code observed in 33744292112 is in this table verbatim.
const CASES = [
  { name: 'repair exits 2 (the observed internal-link-graph failure)', input: { code: 2, changed: false }, expect: FAILED },
  { name: 'repair exits 2 having changed files anyway', input: { code: 2, changed: true }, expect: FAILED },
  { name: 'repair exits 127 (command not found)', input: { code: 127, changed: false }, expect: FAILED },
  { name: 'repair exits 1', input: { code: 1, changed: false }, expect: FAILED },
  { name: 'repair exits 0 having changed nothing', input: { code: 0, changed: false }, expect: NO_OP },
  { name: 'repair exits 0 having changed the tree', input: { code: 0, changed: true }, expect: REPAIRED },
  { name: 'dry run does not execute', input: { dry: true }, expect: DRY_RUN_SKIPPED },
];

let casesChecked = 0;
for (const c of CASES) {
  casesChecked += 1;
  let got;
  try { got = classifyRepair(c.input); } catch (e) { got = `THREW: ${e.message}`; }
  if (got !== c.expect) errors.push(`classifyRepair(${JSON.stringify(c.input)}) => ${got}, expected ${c.expect} (${c.name})`);
  // The load-bearing half: nothing that did not change the tree may be called a repair.
  if (got === REPAIRED && !(c.input.code === 0 && c.input.changed === true)) {
    errors.push(`classifyRepair(${JSON.stringify(c.input)}) reported ${REPAIRED} without a zero exit and a changed tree - this is the lying status that made run 33744292112 burn all three attempts.`);
  }
}

// An unmeasured repair must not default to success.
casesChecked += 1;
let threw = false;
try { classifyRepair({ code: 0 }); } catch { threw = true; }
if (!threw) errors.push('classifyRepair({code:0}) with no `changed` evidence did not throw - a repair whose effect was never measured must not be assumed to have worked.');
casesChecked += 1;
threw = false;
try { classifyRepair({}); } catch { threw = true; }
if (!threw) errors.push('classifyRepair({}) with no exit code did not throw - an unobserved repair must not classify at all.');

const ATTEMPTS = [
  { name: 'every repair failed', outcomes: [FAILED], expect: REPAIR_FAILED, retry: false },
  { name: 'the observed case: single repair exited non-zero', outcomes: [FAILED, FAILED], expect: REPAIR_FAILED, retry: false },
  { name: 'every repair was a no-op', outcomes: [NO_OP, NO_OP], expect: REPAIR_INEFFECTIVE, retry: false },
  { name: 'failed and no-op mixed, nothing changed', outcomes: [FAILED, NO_OP], expect: REPAIR_FAILED, retry: false },
  { name: 'one repair changed the tree', outcomes: [FAILED, REPAIRED], expect: REPAIRED_RETRYING, retry: true },
  { name: 'all repaired', outcomes: [REPAIRED], expect: REPAIRED_RETRYING, retry: true },
  { name: 'dry run', outcomes: [DRY_RUN_SKIPPED], expect: DRY_RUN, retry: false },
];
for (const c of ATTEMPTS) {
  casesChecked += 1;
  let got;
  try { got = classifyAttempt(c.outcomes); } catch (e) { got = `THREW: ${e.message}`; }
  if (got !== c.expect) errors.push(`classifyAttempt(${JSON.stringify(c.outcomes)}) => ${got}, expected ${c.expect} (${c.name})`);
  if (got === REPAIRED_RETRYING && !c.outcomes.includes(REPAIRED)) {
    errors.push(`classifyAttempt(${JSON.stringify(c.outcomes)}) claimed ${REPAIRED_RETRYING} with no repair that actually repaired - this is precisely the mismapping observed in run 33744292112.`);
  }
  if (typeof got === 'string' && !got.startsWith('THREW') && shouldRetry(got) !== c.retry) {
    errors.push(`shouldRetry(${got}) => ${shouldRetry(got)}, expected ${c.retry} (${c.name}). Retrying a tree no repair changed can only reproduce the same failure.`);
  }
}

casesChecked += 1;
threw = false;
try { classifyAttempt([]); } catch { threw = true; }
if (!threw) errors.push('classifyAttempt([]) did not throw - an attempt that ran zero repairs must be reported as NO_REPAIR_AVAILABLE, never classified as a repair attempt.');

if (casesChecked === 0) {
  errors.push('examined zero contract cases: this gate proved nothing. A run that checked nothing has not passed.');
}

// ---------------------------------------------------------------- 2. wiring
let wiringChecks = 0;
const loopPath = path.join(ROOT, LOOP);
if (!fs.existsSync(loopPath)) {
  errors.push(`${LOOP} is missing - the loop this contract governs does not exist, so the contract governs nothing.`);
} else {
  const src = fs.readFileSync(loopPath, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

  wiringChecks += 1;
  if (!/from\s+'\.\/repair_status\.mjs'/.test(code)) {
    errors.push(`${LOOP} does not import ./repair_status.mjs. The status contract is only enforced where it is called; an uncalled contract is decoration.`);
  }
  wiringChecks += 1;
  if (!/classifyAttempt\s*\(/.test(code)) {
    errors.push(`${LOOP} never calls classifyAttempt(). The attempt result must be derived from what the repairs did, not written next to them.`);
  }
  wiringChecks += 1;
  if (!/classifyRepair\s*\(/.test(code)) {
    errors.push(`${LOOP} never calls classifyRepair(). Each repair's outcome must be classified from its exit code and its effect on the tree.`);
  }
  wiringChecks += 1;
  const literal = code.match(/result:\s*'(REPAIRED_RETRYING|REPAIR_FAILED|REPAIR_INEFFECTIVE)'/);
  if (literal) {
    errors.push(`${LOOP} assigns a repair result as a string literal (${literal[0]}). That literal is the original defect: it reported REPAIRED_RETRYING for a repair that had exited 2. Derive it with classifyAttempt().`);
  }
  wiringChecks += 1;
  if (!/shouldRetry\s*\(/.test(code)) {
    errors.push(`${LOOP} never calls shouldRetry(). Without it the loop spends every remaining attempt revalidating a tree no repair changed - three identical attempts, as observed.`);
  }
  wiringChecks += 1;
  if (!/treeFingerprint\s*\(/.test(code)) {
    errors.push(`${LOOP} never fingerprints the tree, so it cannot know whether a repair that exited 0 did anything. Exit 0 having done nothing is not work done.`);
  }
}
if (wiringChecks === 0) {
  errors.push('examined zero wiring assertions: the contract may be correct and entirely unused. That is not a pass.');
}

// ---------------------------------------------------------------- 3. output
// The report is an artifact of the last run, so it may legitimately be absent on
// a fresh checkout. When it is present it is real evidence and is asserted.
let attemptsChecked = 0;
const reportPath = path.join(ROOT, REPORT);
if (fs.existsSync(reportPath)) {
  let doc = null;
  try { doc = JSON.parse(fs.readFileSync(reportPath, 'utf8')); } catch (e) {
    errors.push(`${REPORT} is not valid JSON (${e.message}) - the loop's own report must be readable to be checked.`);
  }
  for (const a of (doc?.attempts || [])) {
    attemptsChecked += 1;
    if (a.result !== REPAIRED_RETRYING) continue;
    const repairs = Array.isArray(a.repaired) ? a.repaired : [];
    if (repairs.some((r) => r.dry)) continue;
    const outcomes = repairs.map((r) => r.outcome).filter(Boolean);
    if (outcomes.length !== repairs.length) {
      errors.push(`${REPORT} attempt ${a.attempt} claims ${REPAIRED_RETRYING} but ${repairs.length - outcomes.length} of its repairs carry no classified outcome - an unclassified repair is an unproven one.`);
      continue;
    }
    if (!outcomes.includes(REPAIRED)) {
      errors.push(`${REPORT} attempt ${a.attempt} claims ${REPAIRED_RETRYING} while no repair reported ${REPAIRED} (outcomes: ${outcomes.join(', ') || 'none'}; exits: ${repairs.map((r) => r.code).join(', ')}). This is the exact record run 33744292112 produced three times.`);
    }
    for (const r of repairs) {
      if (r.code !== 0 && r.outcome === REPAIRED) {
        errors.push(`${REPORT} attempt ${a.attempt}: repair ${r.id} exited ${r.code} and is recorded as ${REPAIRED}.`);
      }
      if (r.code === 0 && r.changed === false && r.outcome === REPAIRED) {
        errors.push(`${REPORT} attempt ${a.attempt}: repair ${r.id} changed no file and is recorded as ${REPAIRED}.`);
      }
    }
  }
}

// ---------------------------------------------------------------- verdict
console.log(`  contract cases examined=${casesChecked} wiring assertions=${wiringChecks} report attempts examined=${attemptsChecked}`);
if (errors.length) {
  for (const e of errors) console.error(`  FAIL ${e}`);
  console.error(`self-heal status contract: FAIL (${errors.length} problem(s))`);
  process.exit(1);
}
console.log(`self-heal status contract: PASS (${casesChecked} case(s), ${wiringChecks} wiring assertion(s), ${attemptsChecked} recorded attempt(s))`);
