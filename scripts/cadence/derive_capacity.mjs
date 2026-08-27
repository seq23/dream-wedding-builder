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
 * Usage: node scripts/cadence/derive_capacity.mjs [--write] [--json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { isComplete } from '../../lib/authority-complete.mjs';

const root = process.cwd();
const WRITE = process.argv.includes('--write');
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

const firstCommitDate = git('log', '--reverse', '--format=%ad', '--date=short').trim().split('\n')[0];
const today = new Date().toISOString().slice(0, 10);
const weeks = Math.max(1, (new Date(today) - new Date(firstCommitDate)) / (86400000 * 7));
const current = series.length ? series[series.length - 1].renderable : 0;
const throughput = current / weeks;

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
  repo_age_weeks: Number(weeks.toFixed(1)),
  renderable_guides_now: current,
  sustained_throughput_per_week: Number(throughput.toFixed(2)),
  best_single_interval_per_week: Number(bestBurst.toFixed(2)),
  why_not_the_burst:
    'The best interval is a one-off bulk authoring event. Building a schedule on it guarantees the schedule is missed, which is how a cadence turns into a quota.',
  authoring_events_observed: series.filter((s, i) => i === 0 || s.renderable !== series[i - 1].renderable).length,
  refresh_capacity_per_week: refreshCapacity,
  new_pages_per_week: newPerWeek,
};

const report = { ...derivation, series };
fs.mkdirSync(path.join(root, 'reports/cadence'), { recursive: true });
fs.writeFileSync(path.join(root, 'reports/cadence/capacity-derivation.json'), JSON.stringify(report, null, 2) + '\n');

if (WRITE) {
  const policy = JSON.parse(fs.readFileSync(path.join(root, POLICY), 'utf8'));
  policy.refresh_capacity_per_week = refreshCapacity;
  policy.new_pages_per_week = newPerWeek;
  policy._capacity_source = 'scripts/cadence/derive_capacity.mjs - see reports/cadence/capacity-derivation.json';
  policy._capacity_derivation = {
    renderable_guides_now: current,
    repo_age_weeks: derivation.repo_age_weeks,
    sustained_throughput_per_week: derivation.sustained_throughput_per_week,
  };
  fs.writeFileSync(path.join(root, POLICY), JSON.stringify(policy, null, 2) + '\n');
}

if (JSON_ONLY) console.log(JSON.stringify(derivation, null, 2));
else {
  console.log(`CAPACITY DERIVED from ${series.length} registry commits over ${derivation.repo_age_weeks} weeks`);
  console.log(`  renderable guides now         ${current}`);
  console.log(`  sustained throughput          ${derivation.sustained_throughput_per_week}/week`);
  console.log(`  best single interval          ${derivation.best_single_interval_per_week}/week (not used)`);
  console.log(`  -> refresh_capacity_per_week  ${refreshCapacity}`);
  console.log(`  -> new_pages_per_week         ${newPerWeek}`);
  if (WRITE) console.log(`  written to ${POLICY}`);
}
