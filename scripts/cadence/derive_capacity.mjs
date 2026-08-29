#!/usr/bin/env node
/**
 * Derive this repo's publishing cadence from what it has actually produced.
 *
 * The number this replaces
 * -----------------------
 * refresh_capacity_per_week was 25. It traced to one unsourced sentence and no
 * repo in the portfolio ever sustained it. A cadence that nothing has ever met is
 * not a cadence, it is a target, and a target pointed at a generator is an
 * instruction to manufacture filler. So the direction is inverted here: cadence is
 * read out of history, and the generator publishes only what is actually ready.
 *
 * What is measured
 * ----------------
 * Renderable guides in data/authority/content_registry.json, at every commit that
 * touched it, over the repo's whole life. "Renderable" is isComplete() - the same
 * predicate the router applies - because a record that 404s was never capacity.
 * Throughput is net renderable guides added, divided by repo age in weeks.
 *
 * Whole-life average is deliberate. Taking the best burst would reproduce exactly
 * the failure being corrected: the 07-30 bulk authoring event alone rates about
 * 16 guides/week, and nothing before or since has come close to it. The sustained
 * number is the one a schedule can be built on.
 *
 * Refresh capacity is set to the same figure rather than a separate guess. A
 * refresh of one of these guides is the same unit of work as authoring a new one -
 * three sentences of judgement over a fixed scaffold - so one measured throughput
 * funds both, and new pages are capped well below it so the majority of capacity
 * stays available for keeping the tail inside the 91-day citability window.
 *
 * --check: the loop was open
 * ---------------------------
 * These two numbers are derived from a rate and then written into
 * data/cadence/policy.json as literals. Until 2026-08-29 no workflow ran this
 * script, so nothing re-derived them and nothing asserted they still followed
 * from the measurement. Proved with a simulated clock on 2026-08-29: the stored
 * policy said refresh 11 / new 5, and this same unmodified derivation yields
 * 9/4 by 2026-09-05, 7/3 by 2026-09-20 and 5/2 by 2026-10-20 - so the publisher
 * would have kept releasing 5 guides a week against a measured sustainable 2,
 * and cadence_gate.js would have computed its maintainable_ceiling (refresh
 * capacity x 13 weeks) from a rate the repo no longer achieves. A rate used as a
 * total, getting staler every day it was not re-derived.
 *
 * --check fails when the stored policy claims MORE capacity than the measurement
 * supports, or when new_pages_per_week no longer follows from
 * refresh_capacity_per_week. It carries a repair_command in
 * _repo_validation_registry.json, so the publishing lane re-derives rather than
 * waiting for a human. A shallow clone cannot measure history at all and is a
 * hard failure, never a quiet pass.
 *
 * Usage: node scripts/cadence/derive_capacity.mjs [--write] [--json] [--check]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { isComplete } from '../../lib/authority-complete.mjs';

const root = process.cwd();
const WRITE = process.argv.includes('--write');
const CHECK = process.argv.includes('--check');
const JSON_ONLY = process.argv.includes('--json');
const REGISTRY = 'data/authority/content_registry.json';
const POLICY = 'data/cadence/policy.json';
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const commits = git('log', '--format=%H|%ad', '--date=short', '--', REGISTRY)
  .trim().split('\n').filter(Boolean)
  .map((l) => { const [sha, date] = l.split('|'); return { sha, date }; })
  .reverse();

const series = [];
for (const c of commits) {
  let renderable = 0;
  try {
    const blob = git('show', `${c.sha}:${REGISTRY}`);
    renderable = (JSON.parse(blob).pages ?? []).filter(isComplete).length;
  } catch { continue; }
  series.push({ ...c, renderable });
}

// A shallow clone cannot see the history this measurement is made of. Passing
// there would be a validator that hardcodes PASS in exactly the environment (CI)
// where it is most likely to be the only thing looking.
if (CHECK) {
  const shallow = git('rev-parse', '--is-shallow-repository').trim() === 'true';
  if (shallow || series.length < 2) {
    console.error('CADENCE POLICY CHECK CANNOT RUN: ' + (shallow ? 'this is a shallow clone' : `only ${series.length} registry commit(s) are visible`) + '.');
    console.error('  The cadence policy is derived from committed history. Check out with fetch-depth: 0.');
    process.exit(1);
  }
}

// Measure over the period this repo was actually authoring guides, not over its
// whole existence. The registry did not exist for the first 6.7 weeks; counting
// those as authoring weeks halves the apparent rate and produces a cap the repo has
// already beaten twice. Both figures are reported so the choice is auditable.
const firstCommitDate = git('log', '--reverse', '--format=%ad', '--date=short').trim().split('\n')[0];
const firstContentDate = series.length ? series[0].date : firstCommitDate;
const today = new Date().toISOString().slice(0, 10);
const weeksSinceRepoStart = Math.max(1, (new Date(today) - new Date(firstCommitDate)) / (86400000 * 7));
const weeks = Math.max(1, (new Date(today) - new Date(firstContentDate)) / (86400000 * 7));
const current = series.length ? series[series.length - 1].renderable : 0;
const throughput = current / weeks;
const throughputSinceRepoStart = current / weeksSinceRepoStart;

// Best single interval, reported to show why it is not the number used.
let bestBurst = 0;
for (let i = 1; i < series.length; i++) {
  const dw = Math.max(1 / 7, (new Date(series[i].date) - new Date(series[i - 1].date)) / (86400000 * 7));
  const rate = (series[i].renderable - series[i - 1].renderable) / dw;
  if (rate > bestBurst) bestBurst = rate;
}

// Floor, never round up: capacity claimed above what was demonstrated is the
// unsourced number all over again.
const refreshCapacity = Math.max(1, Math.floor(throughput));
// New pages take a minority of capacity so the rest can hold the tail inside the
// refresh window. Half, floored, and never more than the refresh figure.
const newPerWeek = Math.max(1, Math.floor(refreshCapacity / 2));

const derivation = {
  derived_at: today,
  derived_by: 'scripts/cadence/derive_capacity.mjs',
  measured_from: REGISTRY,
  predicate: 'lib/authority-complete.mjs isComplete() - a record the router 404s was never capacity',
  first_commit: firstCommitDate,
  first_content_commit: firstContentDate,
  authoring_weeks: Number(weeks.toFixed(1)),
  repo_age_weeks: Number(weeksSinceRepoStart.toFixed(1)),
  renderable_guides_now: current,
  sustained_throughput_per_week: Number(throughput.toFixed(2)),
  throughput_if_measured_from_repo_start: Number(throughputSinceRepoStart.toFixed(2)),
  window_choice:
    'Measured from the first commit that created content, not from the first commit in the repo. The registry did not exist for the first weeks of this repo and no guide could have been written in them, so including them measures setup time as authoring time and understates capacity by roughly half.',
  best_single_interval_per_week: Number(bestBurst.toFixed(2)),
  why_not_the_burst:
    'The best interval is a one-off bulk authoring event. Building a schedule on it guarantees the schedule is missed, which is how a cadence turns into a quota.',
  authoring_events_observed: series.filter((s, i) => i === 0 || s.renderable !== series[i - 1].renderable).length,
  refresh_capacity_per_week: refreshCapacity,
  new_pages_per_week: newPerWeek,
};

const report = { ...derivation, series };
// --check is a validator and must not mutate: it runs inside validate:structural,
// and a validator that dirties the tree turns every run into a spurious diff for
// the lanes that `git add -A`.
if (!CHECK) {
  fs.mkdirSync(path.join(root, 'reports/cadence'), { recursive: true });
  fs.writeFileSync(path.join(root, 'reports/cadence/capacity-derivation.json'), JSON.stringify(report, null, 2) + '\n');
}

if (WRITE) {
  const policy = JSON.parse(fs.readFileSync(path.join(root, POLICY), 'utf8'));
  policy.refresh_capacity_per_week = refreshCapacity;
  policy.new_pages_per_week = newPerWeek;
  policy._capacity_source = 'scripts/cadence/derive_capacity.mjs - see reports/cadence/capacity-derivation.json';
  policy._capacity_derivation = {
    renderable_guides_now: current,
    measured_from: firstContentDate,
    authoring_weeks: derivation.authoring_weeks,
    sustained_throughput_per_week: derivation.sustained_throughput_per_week,
    best_single_interval_per_week: derivation.best_single_interval_per_week,
    note: 'Whole-period average over the authoring window, floored. The best single interval is a bulk authoring event and is deliberately not used.',
  };
  fs.writeFileSync(path.join(root, POLICY), JSON.stringify(policy, null, 2) + '\n');
}

if (CHECK) {
  const policy = JSON.parse(fs.readFileSync(path.join(root, POLICY), 'utf8'));
  const problems = [];
  const storedRefresh = Number(policy.refresh_capacity_per_week);
  const storedNew = Number(policy.new_pages_per_week);
  // Over-claiming is the direction that does harm: it lets the publisher release
  // faster than the library has ever been maintained. A policy set below the
  // measurement is conservative and is not an error.
  if (!Number.isFinite(storedRefresh) || storedRefresh > refreshCapacity) {
    problems.push(`refresh_capacity_per_week is ${policy.refresh_capacity_per_week} but measured sustained throughput is ${derivation.sustained_throughput_per_week}/week, which supports ${refreshCapacity}`);
  }
  // new_pages_per_week is not independent: it is half the refresh figure, so the
  // rest of capacity stays available to hold the tail inside the refresh window.
  const impliedNew = Math.max(1, Math.floor(storedRefresh / 2));
  if (!Number.isFinite(storedNew) || storedNew !== impliedNew) {
    problems.push(`new_pages_per_week is ${policy.new_pages_per_week} but refresh_capacity_per_week ${policy.refresh_capacity_per_week} implies ${impliedNew} (half, floored)`);
  }
  if (problems.length) {
    console.error('CADENCE POLICY IS STALE - data/cadence/policy.json no longer follows from measured throughput:');
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error('  repair: npm run cadence:derive -- --write');
    process.exit(1);
  }
  console.log(`cadence policy currency: PASS (stored refresh ${storedRefresh}/week, new ${storedNew}/week; measured ${derivation.sustained_throughput_per_week}/week over ${derivation.authoring_weeks} authoring weeks from ${series.length} registry commits)`);
  process.exit(0);
}

if (JSON_ONLY) console.log(JSON.stringify(derivation, null, 2));
else {
  console.log(`CAPACITY DERIVED from ${series.length} registry commits over ${derivation.authoring_weeks} authoring weeks (repo is ${derivation.repo_age_weeks} weeks old)`);
  console.log(`  renderable guides now         ${current}`);
  console.log(`  sustained throughput          ${derivation.sustained_throughput_per_week}/week`);
  console.log(`  (from repo start instead)     ${derivation.throughput_if_measured_from_repo_start}/week - understates, includes weeks with no registry`);
  console.log(`  best single interval          ${derivation.best_single_interval_per_week}/week (not used)`);
  console.log(`  -> refresh_capacity_per_week  ${refreshCapacity}`);
  console.log(`  -> new_pages_per_week         ${newPerWeek}`);
  if (WRITE) console.log(`  written to ${POLICY}`);
}
