#!/usr/bin/env node
/**
 * The cadence policy must follow from the tree, never from the clock.
 *
 * WHAT WENT WRONG
 * ---------------
 * Three scheduled runs went red on 2026-09-04 - CI 33874876728, Search
 * Intelligence 33869403684 and Full Safe Autonomy 33863160216 - all on commit
 * 3990a02, none with a code change behind them. Commit 3990a02 had been green at
 * 23:25 the night before.
 *
 * scripts/cadence/derive_capacity.mjs measured throughput as
 * `renderable_guides_now / weeks_since_first_content_commit`: a cumulative stock
 * over a denominator that grows with the wall clock. 79 guides read 10.05/week on
 * 2026-09-03 and 9.88/week on 2026-09-04, and Math.floor turned that continuous
 * drift into a cliff on one arbitrary calendar day. The policy stored 10, --check
 * demanded no more than 9, and every lane running validate:structural went red.
 * `--write` was not a repair, only a postponement: the next boundary was six days
 * out.
 *
 * The same drift blocked the publishing lane by a second route. The publisher read
 * new_pages_per_week: 5 and released exactly 5 guides; the re-derive step then
 * lowered the figure to 4; cadence_gate.js blocked the run for publishing 5 against
 * a cap of 4 that did not exist when they were published. The gate exits ahead of
 * the commit step, so the guides, the policy and known_urls.json were all
 * discarded and the next night reproduced the identical block.
 *
 * WHAT THIS ASSERTS - by executing it, not by describing it
 * --------------------------------------------------------
 *  1. DETERMINISM. derive_capacity.mjs is run under a spread of simulated system
 *     clocks - the day the boundary was crossed, and horizons out to a year - with
 *     the working tree untouched. Every run must yield byte-identical capacity
 *     figures, and `--check` must exit 0 at every one of them. This is the
 *     assertion that would have gone red on 2026-09-03 and caught the whole class
 *     before it reached main.
 *  2. SOURCE. The measurement window must close on a commit date. A `new Date()`
 *     or `Date.now()` feeding the throughput calculation is a hard failure, so the
 *     wall clock cannot creep back into the numerator or the denominator.
 *  3. ORDERING. In any workflow where the cadence policy is re-derived and also
 *     spent, the re-derivation must come first. A budget may not be lowered after
 *     it has been spent and then used to judge the spending.
 *
 * Rule 0: it counts simulated clocks, source assertions and workflow lanes, and
 * hard-fails on zero of any of them rather than passing on an empty loop.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const DERIVE = 'scripts/cadence/derive_capacity.mjs';
const POLICY = 'data/cadence/policy.json';
const WORKFLOWS = '.github/workflows';
const errors = [];

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));

for (const required of [DERIVE, POLICY]) {
  if (!exists(required)) {
    console.error(`cadence determinism: FAIL - ${required} is missing, so there is nothing to assert. A validator with no subject has not passed.`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------- 1. determinism
//
// A CommonJS preload replaces the global Date before the ESM entry point loads, so
// the derivation runs against a lie about what day it is while the repository on
// disk is untouched. No test hook is added to the production script: a hook would be
// one more thing that could be wired wrong, and the defect being guarded is
// precisely that the script consults the clock at all.
const clockShim = (isoDay) => `
'use strict';
const RealDate = Date;
const FIXED = RealDate.parse('${isoDay}T12:00:00.000Z');
class FrozenDate extends RealDate {
  constructor(...args) { if (args.length === 0) { super(FIXED); } else { super(...args); } }
  static now() { return FIXED; }
  static parse(...args) { return RealDate.parse(...args); }
  static UTC(...args) { return RealDate.UTC(...args); }
}
globalThis.Date = FrozenDate;
`;

// 2026-09-03 and 2026-09-04 are the two days that produced opposite verdicts from
// the same commit. The rest are horizons far enough out that any surviving
// wall-clock term would have to show itself.
const SIMULATED_CLOCKS = ['2026-09-03', '2026-09-04', '2026-09-05', '2026-09-11', '2026-10-04', '2026-12-04', '2027-09-04'];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cadence-determinism-'));
const shimPath = (day) => {
  const f = path.join(tmp, `clock-${day}.cjs`);
  fs.writeFileSync(f, clockShim(day));
  return f;
};

const runAt = (day, args) => spawnSync(process.execPath, [path.join(ROOT, DERIVE), ...args], {
  cwd: ROOT,
  encoding: 'utf8',
  env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require ${shimPath(day)}`.trim() },
});

let clocksExamined = 0;
const derivations = [];
for (const day of SIMULATED_CLOCKS) {
  const derived = runAt(day, ['--json']);
  if (derived.status !== 0) {
    errors.push(`derivation exited ${derived.status} under a simulated clock of ${day}: ${(derived.stderr || derived.stdout || '').trim().split('\n').slice(-3).join(' / ')}`);
    continue;
  }
  let parsed;
  try { parsed = JSON.parse(derived.stdout); }
  catch { errors.push(`derivation under a simulated clock of ${day} did not emit parseable JSON`); continue; }

  // The two numbers that are written into the policy, plus the rate they come from.
  // throughput_if_measured_to_today is deliberately excluded: it is the reported
  // diagnostic that is *supposed* to move with the clock.
  derivations.push({
    day,
    fingerprint: JSON.stringify({
      refresh_capacity_per_week: parsed.refresh_capacity_per_week,
      new_pages_per_week: parsed.new_pages_per_week,
      sustained_throughput_per_week: parsed.sustained_throughput_per_week,
      authoring_weeks: parsed.authoring_weeks,
      renderable_guides_now: parsed.renderable_guides_now,
    }),
  });

  const checked = runAt(day, ['--check']);
  if (checked.status !== 0) {
    errors.push(`\`--check\` exits ${checked.status} under a simulated clock of ${day} against an unchanged tree: ${(checked.stderr || '').trim().split('\n').slice(0, 2).join(' / ')}. The stored policy must be judged against committed history, not against the date it is judged on.`);
  }
  clocksExamined += 1;
}

if (derivations.length > 1) {
  const [first, ...rest] = derivations;
  for (const d of rest) {
    if (d.fingerprint !== first.fingerprint) {
      errors.push(`the derivation is not a function of the tree: a simulated clock of ${first.day} yields ${first.fingerprint} but ${d.day} yields ${d.fingerprint}. Close the measurement window on a commit date.`);
    }
  }
}

// Rule 0.
if (clocksExamined === 0) {
  console.error('cadence determinism: FAIL - zero simulated clocks were examined, so nothing about determinism was proved.');
  process.exit(1);
}

// ---------------------------------------------------------------- 2. source
const deriveSource = read(DERIVE);
const sourceAssertions = [];

// Strip comments before looking for clock reads, so the docblock explaining the
// defect does not itself read as the defect.
const codeOnly = deriveSource
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !/^\s*\/\//.test(l))
  .join('\n');

sourceAssertions.push(['window closes on a commit date', /lastContentDate\s*=\s*series\.length/.test(codeOnly),
  `${DERIVE} must close the measurement window at the last commit that changed the registry. Without \`lastContentDate\` derived from the commit series there is nothing anchoring the window to committed history.`]);

sourceAssertions.push(['throughput is not divided by a wall-clock span', !/const\s+weeks\s*=[^;]*new Date\(\)/.test(codeOnly),
  `${DERIVE} divides by a span ending at \`new Date()\`. That is the original defect: the denominator grows every day and floor() drops the capacity a whole unit on an arbitrary calendar date.`]);

// The one permitted clock read is the reported-and-unused diagnostic.
const clockReads = codeOnly.split('\n')
  .map((line, i) => ({ line: line.trim(), n: i + 1 }))
  .filter(({ line }) => /new Date\(\)|Date\.now\(\)/.test(line));
const strayClockReads = clockReads.filter(({ line }) => !/throughputIfMeasuredToToday/.test(line));
sourceAssertions.push(['no clock read outside the reported diagnostic', strayClockReads.length === 0,
  `${DERIVE} reads the wall clock at line(s) ${strayClockReads.map((c) => c.n).join(', ')}: ${strayClockReads.map((c) => c.line).join(' | ')}. Only throughput_if_measured_to_today, which is reported and never used, may consult the clock.`]);

for (const [name, ok, message] of sourceAssertions) {
  if (!ok) errors.push(`${message} (assertion: ${name})`);
}
if (sourceAssertions.length === 0) {
  console.error('cadence determinism: FAIL - zero source assertions were made.');
  process.exit(1);
}

// ---------------------------------------------------------------- 3. ordering
//
// Three orderings, each of which has already cost a red run on main.
//
//  a. The budget must be derived BEFORE it is spent. Spending means anything that
//     reads new_pages_per_week or is judged against it: publish_authority_batch.mjs
//     consumes the budget, cadence_gate.js enforces it.
//  b. Nothing may rewrite the budget BETWEEN the spending and the judging. That is
//     run 33863160216 stated exactly: the publisher released the 5 guides it was
//     allowed, a re-derive then lowered the figure to 4, and the gate blocked the
//     run for the difference.
//  c. A lane that COMMITS published content must re-derive AFTER that commit and
//     before it pushes. derive_capacity.mjs measures committed history, so a
//     derivation taken before the content commit is structurally one authoring
//     commit behind. On 2026-09-04 this put a policy of 11/week - measured from 79
//     guides - into the very commit that raised the library to 84, where the
//     measurement supports 10, and main went red on a policy the lane wrote itself.
const SPENDERS = [/authority:scale:publish/, /cadence:gate/];
let lanesExamined = 0;
if (!exists(WORKFLOWS)) {
  console.error(`cadence determinism: FAIL - ${WORKFLOWS} does not exist, so no lane could be examined.`);
  process.exit(1);
}
for (const file of fs.readdirSync(path.join(ROOT, WORKFLOWS)).filter((f) => /\.ya?ml$/.test(f))) {
  const lines = read(path.join(WORKFLOWS, file)).split('\n');
  // Ignore comment lines: several of these workflows describe the ordering defect
  // in prose immediately above the step that fixes it.
  const codeLines = lines.map((l) => (/^\s*#/.test(l) ? '' : l));
  const derivesAt = codeLines.map((l, i) => (/cadence:derive/.test(l) && /--write/.test(l) ? i : -1)).filter((i) => i >= 0);
  if (derivesAt.length === 0) continue;
  lanesExamined += 1;
  const deriveAt = derivesAt[0];

  // (a)
  for (const spender of SPENDERS) {
    const spendAt = codeLines.findIndex((l) => spender.test(l));
    if (spendAt < 0) continue;
    if (spendAt < deriveAt) {
      errors.push(`${WORKFLOWS}/${file} spends the cadence budget at line ${spendAt + 1} (${codeLines[spendAt].trim()}) but only re-derives it at line ${deriveAt + 1}. A budget lowered after it has been spent, then used to judge the spending, is how run 33863160216 failed the publisher for obeying the policy it was given.`);
    }
  }

  // (b)
  const publishAt = codeLines.findIndex((l) => /authority:scale:publish/.test(l));
  const gateAt = codeLines.findIndex((l) => /cadence:gate/.test(l));
  if (publishAt >= 0 && gateAt > publishAt) {
    for (const d of derivesAt) {
      if (d > publishAt && d < gateAt) {
        errors.push(`${WORKFLOWS}/${file} rewrites the cadence budget at line ${d + 1}, between the publisher at line ${publishAt + 1} and the gate at line ${gateAt + 1}. The gate would then judge the publisher against a budget that did not exist when it published - the exact shape of run 33863160216.`);
      }
    }
  }

  // (c)
  if (publishAt >= 0) {
    const firstCommitAt = codeLines.findIndex((l) => /git commit\b/.test(l));
    const lastPushAt = codeLines.reduce((acc, l, i) => (/git push\b/.test(l) ? i : acc), -1);
    if (firstCommitAt >= 0 && lastPushAt > firstCommitAt) {
      const closes = derivesAt.some((d) => d > firstCommitAt && d < lastPushAt);
      if (!closes) {
        errors.push(`${WORKFLOWS}/${file} publishes content and commits it at line ${firstCommitAt + 1}, then pushes at line ${lastPushAt + 1}, without re-deriving the cadence policy in between. derive_capacity.mjs reads committed history, so every derivation taken before that commit is one authoring commit stale - which is how a policy of 11/week measured from 79 guides was committed alongside the 84 that make it 10, and main went red on 2026-09-04.`);
      }
    }
  }
}
if (lanesExamined === 0) {
  console.error('cadence determinism: FAIL - no workflow re-derives the cadence policy, so the ordering assertion examined zero lanes. Either a lane was removed or the step was renamed; a gate that governs nothing has not passed.');
  process.exit(1);
}

// ---------------------------------------------------------------- verdict
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`  simulated clocks=${clocksExamined} source assertions=${sourceAssertions.length} re-deriving lanes=${lanesExamined}`);
if (errors.length) {
  for (const e of errors) console.error(`  FAIL ${e}`);
  console.error(`cadence determinism: FAIL (${errors.length} problem(s))`);
  process.exit(1);
}
console.log(`cadence determinism: PASS (${clocksExamined} simulated clock(s) agree on ${JSON.parse(derivations[0].fingerprint).refresh_capacity_per_week}/week refresh and ${JSON.parse(derivations[0].fingerprint).new_pages_per_week}/week new, ${sourceAssertions.length} source assertion(s), ${lanesExamined} re-deriving lane(s))`);
