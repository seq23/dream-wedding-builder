#!/usr/bin/env node
// data/brand-social/metrics.json is a file the Boss OS Monday scorecard trusts
// (row `dw-brand-social`): posts_published_28d, social_visits_28d, updatedAt.
//
// Why: the row went unread for its whole life because the file never existed, and
// the visits half could not have been measured anyway - the Web Analytics beacon
// posted cross-origin and the browser dropped every page load from 8 Oct to 9 Nov
// 2026 (docs/analytics/web-analytics-beacon.md). The failure this gate is written
// against is the quiet one that follows a fix like that: a 0 written for a channel
// nobody could measure, which reads on the scorecard as "the channel is dead".
//
// It asserts (scripts/brand_social/lib.mjs metricsProblems):
//   - each metric is a finite count OR absent with a reason in `unread` (never both,
//     never neither);
//   - a visits number is backed by an `ok` beacon and >0 recorded page loads on the
//     headline host, and equals that host's by_host tally;
//   - updatedAt is an ISO time; by_host lists at least one host;
//   - data/brand-social/social_referrers.json names hostnames only, for both platforms;
//   - an absent metric names its kind (missing_key | no_traffic | broken), and
//     missing_keys lists bare env-var names exactly when a metric waits on a key,
//     each with a missing_since date that is not in the future (the start of the
//     14-day grace the daily stop check enforces);
//   - the daily workflow runs the collector, commits through push_back.sh, and runs
//     the stop check after the commit (a broken read reds the run).
// Rule 0: it self-tests first (a fixture with an unmeasured zero must fail it), and
// it fails on zero fields or zero hosts checked. Staleness is NOT gated here - a
// network job's lateness must never red a pull request; the scorecard reports it.
import fs from 'node:fs';
import path from 'node:path';
import { isStale, metricsProblems, METRIC_FIELDS, PLATFORMS, unreadSummary } from '../brand_social/lib.mjs';

const ROOT = process.argv[2] || '.';
const TAG = '[validate:brand-social]';
const now = Date.now();
const failures = [];
const dayOffset = (days) => new Date(now + days * 86_400_000).toISOString().slice(0, 10);

// ── Self-test: the gate must reject what it exists to reject. ───────────────────
const good = {
  updatedAt: new Date(now).toISOString(), headline_host: 'weddingchecklistpdf.com', posts_published_28d: 0, social_visits_28d: 2, unread: {},
  by_host: { 'weddingchecklistpdf.com': { pageloads: 40, beacon: 'ok', social_visits: 2 } }
};
const waiting = (() => {
  const m = { ...good, unread: { posts_published_28d: 'key not set' }, unread_kind: { posts_published_28d: 'missing_key' }, missing_keys: ['BUFFER_BRANDS_ACCESS_TOKEN'], missing_since: { BUFFER_BRANDS_ACCESS_TOKEN: dayOffset(-3) } };
  delete m.posts_published_28d;
  return m;
})();
const bad = {
  'an unmeasured zero (no beacon, no page loads)': { ...good, social_visits_28d: 0, by_host: { 'weddingchecklistpdf.com': { pageloads: 0, beacon: 'the beacon posts cross-origin', social_visits: 0 } } },
  'a missing metric with no reason': (() => { const m = { ...good }; delete m.posts_published_28d; return m; })(),
  'a metric that is both a number and unread': { ...good, unread: { social_visits_28d: 'x' } },
  'a non-ISO updatedAt': { ...good, updatedAt: 'yesterday' },
  'zero hosts measured': { ...good, by_host: {} },
  'an absent metric with no unread_kind': { ...waiting, unread_kind: {} , missing_keys: [] },
  'an unknown unread_kind': { ...waiting, unread_kind: { posts_published_28d: 'later' }, missing_keys: [] },
  'a missing_key kind with empty missing_keys': { ...waiting, missing_keys: [] },
  'a missing_keys entry that is not a bare env-var name': { ...waiting, missing_keys: ['the Buffer token'] },
  'a missing key with no missing_since': { ...waiting, missing_since: {} },
  'a missing_since in the future': { ...waiting, missing_since: { BUFFER_BRANDS_ACCESS_TOKEN: dayOffset(3) } },
  'a missing_since for a key not listed': { ...waiting, missing_since: { ...waiting.missing_since, OTHER_KEY: dayOffset(-1) } }
};
for (const [name, fixture] of Object.entries({ 'a sound fixture': good, 'a sound fixture waiting on a key': waiting })) {
  if (metricsProblems(fixture, now).length) failures.push(`self-test: ${name} was rejected (${metricsProblems(fixture, now).join('; ')})`);
}
for (const [name, fixture] of Object.entries(bad)) {
  if (metricsProblems(fixture, now).length === 0) failures.push(`self-test: ${name} passed, so this gate cannot see that defect`);
}
// The deadline the daily stop check enforces: 3 days waiting is a note, 20 days a break.
if (unreadSummary(waiting, now).breaks.length !== 0) failures.push('self-test: a key missing 3 days was a break; the grace is 14 days');
const late = { ...waiting, missing_since: { BUFFER_BRANDS_ACCESS_TOKEN: dayOffset(-20) } };
if (unreadSummary(late, now).breaks.length !== 1) failures.push('self-test: a key missing 20 days was not a break, so a blank scorecard row could stay green for ever');

// ── The committed file ──────────────────────────────────────────────────────────
const metricsPath = path.join(ROOT, 'data/brand-social/metrics.json');
let fieldsChecked = 0;
let hostsChecked = 0;
if (!fs.existsSync(metricsPath)) {
  failures.push('data/brand-social/metrics.json does not exist; the scorecard row reads it from the default branch (run scripts/brand_social/collect_metrics.mjs)');
} else {
  let metrics;
  try { metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8')); } catch (error) { failures.push(`data/brand-social/metrics.json is not JSON (${error.message})`); }
  if (metrics) {
    for (const problem of metricsProblems(metrics, now)) failures.push(`metrics.json: ${problem}`);
    fieldsChecked = METRIC_FIELDS.length;
    hostsChecked = Object.keys(metrics.by_host ?? {}).length;
    if (isStale(metrics, now)) console.warn(`${TAG} WARNING: updatedAt ${metrics.updatedAt} is older than the scorecard's 9 days; the daily workflow has not refreshed it`);
    for (const field of METRIC_FIELDS) {
      console.log(`${TAG} ${field}: ${field in metrics ? metrics[field] : `not read [${metrics.unread_kind?.[field]}] - ${metrics.unread?.[field]}`}`);
    }
  }
}

// ── The referrer list: hostnames only ───────────────────────────────────────────
const referrers = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/brand-social/social_referrers.json'), 'utf8'));
for (const platform of PLATFORMS) {
  const list = referrers.platforms?.[platform] ?? [];
  if (list.length === 0) failures.push(`social_referrers.json lists no ${platform} hostnames`);
  for (const host of list) {
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) failures.push(`social_referrers.json ${platform} entry ${JSON.stringify(host)} is not a bare hostname (no scheme, path or port)`);
  }
}

// ── The daily writer is wired ───────────────────────────────────────────────────
const wfPath = path.join(ROOT, '.github/workflows/brand-social-metrics.yml');
if (!fs.existsSync(wfPath)) failures.push('.github/workflows/brand-social-metrics.yml does not exist, so nothing refreshes the file');
else {
  const wf = fs.readFileSync(wfPath, 'utf8');
  if (!/brand-social:collect|scripts\/brand_social\/collect_metrics\.mjs/.test(wf)) failures.push('brand-social-metrics.yml never runs the collector');
  if (!wf.includes('scripts/ci/push_back.sh')) failures.push('brand-social-metrics.yml does not commit through scripts/ci/push_back.sh');
  const stopAt = wf.search(/brand-social:stop-check|scripts\/brand_social\/stop_check\.mjs/);
  if (stopAt < 0) failures.push('brand-social-metrics.yml never runs the stop check, so a broken read stays green');
  else if (stopAt < wf.indexOf('scripts/ci/push_back.sh')) failures.push('brand-social-metrics.yml runs the stop check before push_back.sh; the file must land first or a wait freezes it stale');
  if (!/^\s*schedule:/m.test(wf)) failures.push('brand-social-metrics.yml has no schedule');
}

if (fieldsChecked === 0 || hostsChecked === 0) failures.push(`checked ${fieldsChecked} field(s) and ${hostsChecked} host(s); a run that checked nothing has not passed`);

if (failures.length) {
  for (const message of failures) console.error(`${TAG} FAIL ${message}`);
  process.exit(1);
}
console.log(`${TAG} PASS: ${fieldsChecked} fields, ${hostsChecked} hosts, ${Object.keys(bad).length} self-test defects rejected`);
