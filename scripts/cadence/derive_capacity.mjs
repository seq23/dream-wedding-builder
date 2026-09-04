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
 * Throughput is net renderable guides added, divided by the weeks between the first
 * and the last commit that changed the registry - the period in which authoring was
 * actually observed. Both ends of that window are commit dates, so the measurement
 * is a pure function of committed history and cannot move without a commit.
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
 * from the measurement.
 *
 * --check fails when the stored policy claims MORE capacity than the measurement
 * supports, or when new_pages_per_week no longer follows from
 * refresh_capacity_per_week. It carries a repair_command in
 * _repo_validation_registry.json, so the publishing lane re-derives rather than
 * waiting for a human. A shallow clone cannot measure history at all and is a
 * hard failure, never a quiet pass.
 *
 * --check must be an assertion about the tree, not about the clock
 * -----------------------------------------------------------------
 * The measurement window used to close at `new Date()`. That made --check
 * non-reproducible: the same commit passed or failed depending on when it was
 * evaluated, because a cumulative numerator over a wall-clock denominator falls a
 * little every day and floor() drops it a whole unit on some arbitrary date. It
 * cost three red scheduled runs on 2026-09-04, none with a code change behind
 * them, and no repair could fix it - `--write` only bought a few days before the
 * next boundary. The window now closes at the last commit that changed the
 * registry, so a green tree stays green until the evidence itself moves, and
 * `--write` is a durable repair. scripts/validators/validate_cadence_determinism.mjs
 * executes that invariant against a spread of simulated clocks.
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

// The measurement window CLOSES at the last commit that changed the registry, not
// at today.
//
// ROOT CAUSE of the three red scheduled runs on 2026-09-04 (33874876728,
// 33869403684, 33863160216), all on 3990a02, none with a code change behind them.
// This divided a cumulative stock - every renderable guide the library holds - by
// wall-clock weeks elapsed since the first content commit. The numerator moves only
// when a guide is written; the denominator moved every time the clock ticked. So
// `sustained_throughput_per_week` was not a property of the tree, it was a function
// of when you happened to look, and floor() turned that continuous drift into a
// cliff on a specific calendar day: 79 guides read 10.05/week on 2026-09-03 and
// 9.88/week on 2026-09-04. The policy stored `10`, --check floors the measurement to
// `9`, and main went red at 12:51 on a commit that had been green at 23:25 the night
// before. `--write` could not fix it either - it only reset the timer for a few days.
//
// The same drift caused the third red by a different route. full-safe-autonomy runs
// `--write` in the same job as the publisher: the publisher read
// new_pages_per_week: 5 and published exactly 5 guides, then this script lowered the
// figure to 4, and cadence_gate.js then blocked the run for publishing 5 against a
// cap of 4 that did not exist when they were published. Because the gate exits 1
// before the commit step, the five guides, the re-derived policy and the URL ledger
// were all discarded - so the next night regenerated the identical five, re-derived
// the identical lower cap and blocked identically. A closed ratchet: not publishing
// lowered the measured rate, which lowered the cap, which blocked publishing.
//
// Closing the window at the last authoring event fixes both. Throughput becomes net
// renderable guides added across the period in which authoring was actually
// observed - which is what "sustained throughput" means - and is a pure function of
// committed history. The same commit yields the same numbers today, tomorrow and in
// a year, so a green tree cannot go red by the calendar and --write is a durable
// repair rather than a postponement.
//
// Nothing is lost by dropping the decay. The decay was a proxy for "the library went
// stale while you were idle", and cadence_gate.js already measures that directly and
// blocks on it: refresh_debt counts pages whose lastmod is past refresh_window_days.
// A proxy that duplicates a direct measurement, and is non-deterministic besides, is
// the worse of the two instruments.
const lastContentDate = series.length ? series[series.length - 1].date : firstContentDate;
const observedDays = (new Date(lastContentDate) - new Date(firstContentDate)) / 86400000;
const weeksSinceRepoStart = Math.max(1, (new Date(lastContentDate) - new Date(firstCommitDate)) / (86400000 * 7));
const weeks = Math.max(1, observedDays / 7);
const current = series.length ? series[series.length - 1].renderable : 0;
const throughput = current / weeks;
const throughputSinceRepoStart = current / weeksSinceRepoStart;

// A weekly rate cannot be read out of less than a week of authoring. Dividing by the
// Math.max(1, ...) floor above would hand back the whole library as a per-week rate -
// an over-claim of exactly the kind this script exists to remove - so it is named and
// refused rather than quietly derived.
if ((CHECK || WRITE) && observedDays < 7) {
  console.error(`CADENCE POLICY CANNOT BE DERIVED: the registry's authoring history spans ${observedDays} day(s) (${firstContentDate} to ${lastContentDate}).`);
  console.error('  A per-week capacity needs at least one week of authoring history behind it. Publish, then re-derive.');
  process.exit(1);
}

// Reported so the choice is auditable, and deliberately not used. This is the figure
// this script used to derive from, and it is the one that moves without a commit.
const throughputIfMeasuredToToday = current / Math.max(1, (new Date(new Date().toISOString().slice(0, 10)) - new Date(firstContentDate)) / (86400000 * 7));

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
  // The date of the evidence, not the date of the run. Anchoring this to the wall
  // clock made reports/cadence/capacity-derivation.json - which is committed - change
  // every single day whether or not anything had happened, and made the number below
  // it disagree with itself across a midnight.
  derived_at: lastContentDate,
  derived_by: 'scripts/cadence/derive_capacity.mjs',
  measured_from: REGISTRY,
  predicate: 'lib/authority-complete.mjs isComplete() - a record the router 404s was never capacity',
  first_commit: firstCommitDate,
  first_content_commit: firstContentDate,
  last_content_commit: lastContentDate,
  authoring_weeks: Number(weeks.toFixed(1)),
  repo_age_weeks: Number(weeksSinceRepoStart.toFixed(1)),
  renderable_guides_now: current,
  sustained_throughput_per_week: Number(throughput.toFixed(2)),
  throughput_if_measured_from_repo_start: Number(throughputSinceRepoStart.toFixed(2)),
  throughput_if_measured_to_today: Number(throughputIfMeasuredToToday.toFixed(2)),
  window_choice:
    'Measured from the first commit that created content, not from the first commit in the repo. The registry did not exist for the first weeks of this repo and no guide could have been written in them, so including them measures setup time as authoring time and understates capacity by roughly half.',
  window_close_choice:
    'The window closes at the last commit that changed the registry, not at today. Closing it at today divides a cumulative stock by a denominator that grows with the clock, so the rate falls every idle day and floor() drops it a whole unit on an arbitrary calendar date - which is what turned three green scheduled runs red on 2026-09-04 with no commit behind them. Anchored to the last authoring event the figure is a pure function of committed history: the same tree derives the same numbers whenever it is measured. throughput_if_measured_to_today is reported to show the difference and is not used.',
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
    measured_through: lastContentDate,
    authoring_weeks: derivation.authoring_weeks,
    sustained_throughput_per_week: derivation.sustained_throughput_per_week,
    best_single_interval_per_week: derivation.best_single_interval_per_week,
    note: 'Average over the observed authoring window - first registry commit to last registry commit - floored. The best single interval is a bulk authoring event and is deliberately not used. The window closes at the last authoring event rather than at today so the figure is a function of committed history and not of the clock; see window_close_choice in reports/cadence/capacity-derivation.json.',
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
  console.log(`  (window held open to today)   ${derivation.throughput_if_measured_to_today}/week (not used) - moves every day without a commit; see window_close_choice`);
  console.log(`  best single interval          ${derivation.best_single_interval_per_week}/week (not used)`);
  console.log(`  -> refresh_capacity_per_week  ${refreshCapacity}`);
  console.log(`  -> new_pages_per_week         ${newPerWeek}`);
  if (WRITE) console.log(`  written to ${POLICY}`);
}
