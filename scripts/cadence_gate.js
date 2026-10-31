#!/usr/bin/env node
/**
 * Cadence gate.
 *
 * The previous gate asked whether pages were earning Google impressions before
 * allowing more publishing. That is the wrong question for an AEO goal: AI
 * citation and Google rank are largely decoupled - most pages AI engines cite do
 * not rank in Google's top 10 - so a page can be invisible in Search and still be
 * cited, or rank and never be cited. Gating publication on Search surfacing
 * measured the wrong thing, and because it never returned a non-zero exit it
 * could not have stopped anything anyway.
 *
 * This gates on freshness and volume, which are the two levers the evidence
 * actually ties to citation:
 *
 *   - Pages not updated within 13 weeks are markedly more likely to lose AI
 *     citations, and recency correlates strongly with being cited at all.
 *   - Publishing faster than a library can be maintained guarantees the tail
 *     ages past that threshold. The ceiling is therefore not a taste question:
 *     it is refresh capacity multiplied by the refresh window.
 *
 * Blocking conditions (exit 1):
 *
 *   1. new pages in the last 7 days above the weekly cap
 *   2. any new page published while the share of pages older than the refresh
 *      window is above the tolerance (refresh debt governs publishing)
 *   3. URLs with no lastmod at all - a crawler gets no freshness signal
 *   4. no sitemap URLs found at all - nothing was measured
 *
 * Refresh debt with nothing new published is a named HOLD (exit 0): the publisher
 * releases nothing, and the pages to refresh are in reports/cadence/refresh-queue.json.
 * A library larger than refresh capacity can keep inside the window is reported.
 *
 * It also warns, without blocking, when a very high share of pages carry the
 * same recent lastmod. That is the signature of a date bump rather than a
 * substantive refresh, and it is worth seeing rather than being rewarded by the
 * freshness rules above.
 *
 * Usage: node cadence_gate.js [--json] [--policy path]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { sitemapUrls, refreshDebt, cadenceToday } = require('./cadence/refresh_debt.cjs');

const ROOT = process.cwd();
const args = process.argv.slice(2);
const JSON_ONLY = args.includes('--json');
const policyPath = (() => {
  const i = args.indexOf('--policy');
  return i >= 0 ? args[i + 1] : 'data/cadence/policy.json';
})();

const DEFAULT_POLICY = {
  refresh_window_days: 91,      // the 13-week threshold
  high_value_window_days: 30,
  stale_tolerance_pct: 20,
  new_pages_per_week: 2,
  refresh_capacity_per_week: 25,
  require_lastmod: true,
};

function loadPolicy() {
  const f = path.join(ROOT, policyPath);
  if (!fs.existsSync(f)) return { ...DEFAULT_POLICY, _source: 'defaults' };
  return { ...DEFAULT_POLICY, ...JSON.parse(fs.readFileSync(f, 'utf8')), _source: policyPath };
}

const policy = loadPolicy();
const urls = sitemapUrls(ROOT);
const today = cadenceToday();
const ageDays = (d) => Math.floor((today - new Date(d)) / 86400000);
const debt = refreshDebt(urls, policy, today);

// A page that changed is not a page that was published. Counting any recent
// lastmod as a new page made a one-off structural edit across the library look
// like a publishing spree, which is exactly the signal this is meant to
// distinguish. New means a URL that was not in the sitemap last time this ran.
const ledgerPath = path.join(ROOT, 'data/cadence/known_urls.json');
let known = new Set();
let ledgerExists = fs.existsSync(ledgerPath);
if (ledgerExists) {
  try { known = new Set(JSON.parse(fs.readFileSync(ledgerPath, 'utf8')).urls || []); }
  catch { ledgerExists = false; }
}
const newUrls = [...urls.keys()].filter((u) => !known.has(u));

const dated = [...urls.entries()].filter(([, d]) => d);
const undated = [...urls.entries()].filter(([, d]) => !d);
const ages = dated.map(([, d]) => ageDays(d));
const stale = debt.stale;
const fresh30 = ages.filter((a) => a <= policy.high_value_window_days).length;
const publishedThisWeek = ages.filter((a) => a <= 7).length;
const stalePct = debt.stale_pct;
const ceiling = policy.refresh_capacity_per_week * Math.floor(policy.refresh_window_days / 7);

const blocking = [];
const warnings = [];

if (ledgerExists && newUrls.length > policy.new_pages_per_week) {
  blocking.push(`weekly_cap: ${newUrls.length} URLs are new since the last run, cap is ${policy.new_pages_per_week} per week`);
}
// A gate that examined nothing has proved nothing. Zero sitemap URLs is the
// inert state this gate's predecessor sat in for weeks reporting CLEAR.
if (urls.size === 0) {
  blocking.push('no_sitemap_urls: no <urlset> sitemap with a <loc> was found under the repo root, so freshness was not measured at all');
}
// Refresh debt governs PUBLISHING. Publishing into a library that is already past
// its refresh tolerance is the thing this gate exists to stop, so that blocks -
// at any count, not only above the weekly cap. Debt with nothing new published is
// a named HOLD: the publisher reads the same numbers (scripts/cadence/
// refresh_debt.cjs) and releases nothing until the oldest pages are refreshed,
// and the pages to refresh are written to reports/cadence/refresh-queue.json.
// Exiting 1 on that state made both scheduled lanes permanently red on
// 2026-10-30, a red that no automated step can clear because a refresh is
// human-authored work in this repo. The refresh lane (scripts/cadence/
// refresh_lane.mjs) now pays that debt down automatically; validate:refresh-lane-wiring
// fails if this hold exists and nothing scheduled reads the queue.
let hold = null;
if (debt.over_tolerance) {
  const what = `${stale} of ${dated.length} pages (${stalePct.toFixed(0)}%) are older than ${policy.refresh_window_days} days, tolerance is ${policy.stale_tolerance_pct}%`;
  if (!ledgerExists) {
    blocking.push(`refresh_debt: ${what}, and there is no URL ledger to prove nothing new was published into it`);
  } else if (newUrls.length) {
    blocking.push(`published_into_refresh_debt: ${newUrls.length} URL(s) are new since the last run while ${what}. Publishing must hold until ${debt.refreshes_needed} of the oldest pages are refreshed: ${newUrls.slice(0, 5).join(', ')}`);
  } else {
    hold = `REFRESH_DEBT: ${what}. Publishing is held (no new URLs this run). Unblocked by substantively refreshing the ${debt.refreshes_needed} oldest page(s) in reports/cadence/refresh-queue.json.`;
  }
} else if (debt.approaching) {
  warnings.push(`refresh_debt_approaching: ${debt.projected_stale} of ${dated.length} pages (${debt.projected_stale_pct.toFixed(0)}%) will be older than ${policy.refresh_window_days} days within ${debt.lookahead_days} days, tolerance is ${policy.stale_tolerance_pct}%. Refresh the oldest pages now; the publisher holds once the line is crossed.`);
}
if (undated.length) {
  const msg = `no_freshness_signal: ${undated.length} sitemap URLs have no lastmod, so a crawler cannot tell when they changed`;
  if (policy.require_lastmod) blocking.push(msg);
  else warnings.push(`${msg} (reported only: ${policy._lastmod_note || 'enforcement disabled for this repo'})`);
}
if (urls.size > ceiling) {
  // Reported, not blocking. A library above the ceiling is a strategic problem -
  // the tail cannot be kept inside the refresh window, so it decays toward zero
  // citation value - but it is not something a publish step can fix, and a gate
  // that is permanently red teaches people to ignore it. It has to be worked
  // down by pruning or by raising real refresh capacity.
  warnings.push(`library_over_ceiling: ${urls.size} pages against a ceiling of ${ceiling} (${policy.refresh_capacity_per_week} substantive refreshes per week held inside ${policy.refresh_window_days} days). ${urls.size - ceiling} pages cannot be kept current at this capacity.`);
}
if (dated.length && publishedThisWeek === dated.length && dated.length > 20) {
  warnings.push(`uniform_lastmod: ${publishedThisWeek} of ${dated.length} pages share a lastmod inside 7 days - that is a date bump pattern, not a refresh, and it makes the freshness signal meaningless`);
}
if (dated.length && fresh30 === 0) {
  warnings.push('no_recent_refresh: nothing has been updated in the last 30 days, where recency correlates most strongly with citation');
}

function report_date() { return today.toISOString().slice(0, 10); }
const report = {
  generated_at: today.toISOString().slice(0, 10),
  policy_source: policy._source,
  urls: urls.size,
  dated: dated.length,
  undated: undated.length,
  stale_over_window: stale,
  stale_pct: Number(stalePct.toFixed(1)),
  fresh_within_30d: fresh30,
  lastmod_within_7d: publishedThisWeek,
  new_since_last_run: ledgerExists ? newUrls.length : null,
  ledger_initialised: ledgerExists,
  maintainable_ceiling: ceiling,
  policy: { ...policy, _source: undefined },
  refreshes_needed: debt.refreshes_needed,
  projected_stale_pct: Number(debt.projected_stale_pct.toFixed(1)),
  blocking,
  hold,
  warnings,
  status: blocking.length ? 'BLOCKED' : hold ? 'HOLD' : 'CLEAR',
};

// Record the current URL set so the next run can tell new from refreshed. Written
// whether or not the gate blocks: the ledger is a record of what exists, not a
// reward for passing.
fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
fs.writeFileSync(ledgerPath, JSON.stringify({ generated_at: report_date(), urls: [...urls.keys()].sort() }, null, 2) + '\n');

fs.mkdirSync(path.join(ROOT, 'reports/cadence'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports/cadence/cadence-gate.json'), JSON.stringify(report, null, 2) + '\n');

// The refresh queue: every page past the window, oldest first, with the registry
// entry that renders it where there is one. Written on every run so a CLEAR run
// leaves an empty queue rather than a stale one.
const guideSlug = (loc) => (loc.match(/\/guides\/([^/?#]+)$/) || [])[1] || null;
// What the refresh lane (scripts/cadence/refresh_lane.mjs, run by
// full-safe-autonomy.yml) last did with each queued page - refreshed, rejected and
// why, or out of its scope - so the queue says who is working it, not just what is old.
let laneLedger = {};
try { laneLedger = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/cadence/refresh_lane_ledger.json'), 'utf8')).pages || {}; } catch { laneLedger = {}; }
const laneKey = (loc) => { try { return new URL(loc).pathname; } catch { return loc; } };
fs.writeFileSync(path.join(ROOT, 'reports/cadence/refresh-queue.json'), JSON.stringify({
  generated_at: report_date(),
  refresh_window_days: policy.refresh_window_days,
  stale: debt.stale,
  refreshes_needed: debt.refreshes_needed,
  note: 'A refresh is a substantive content change (the summary, recommendation or working_example sentences in data/authority/content_registry.json), never a date bump: lastmod comes from git history via scripts/seo/build_lastmod_ledger.mjs.',
  refreshed_by: 'scripts/cadence/refresh_lane.mjs (npm run cadence:refresh), daily in .github/workflows/full-safe-autonomy.yml',
  queue: debt.stale_urls.map((e) => ({ ...e, registry_slug: guideSlug(e.loc), ...(laneLedger[laneKey(e.loc)] ? { refresh_lane: laneLedger[laneKey(e.loc)] } : {}) })),
}, null, 2) + '\n');

if (JSON_ONLY) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`CADENCE GATE ${report.status}: ${urls.size} urls; ${stale} past ${policy.refresh_window_days}d (${report.stale_pct}%); ${fresh30} fresh within ${policy.high_value_window_days}d; ceiling ${ceiling}`);
  for (const b of blocking) console.log(`  BLOCK  ${b}`);
  if (hold && !blocking.length) console.log(`  NAMED STOP  ${hold}`);
  for (const w of warnings) console.log(`  WARN   ${w}`);
}
process.exit(blocking.length ? 1 : 0);
