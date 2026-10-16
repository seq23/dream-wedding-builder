#!/usr/bin/env node
// Weekly Pinterest measurement for the daily drip: Pinterest-referred visits
// (utm_source=pinterest) per pin variant (utm_content), written to
// reports/pinterest/metrics.json and appended to reports/pinterest/metrics_history.json.
//
// What the repo can read today, checked 16 Oct 2026:
//   - Microsoft Clarity: the tag is on every page (scripts/install_clarity.mjs), but
//     reading it needs a Data Export API token (CLARITY_EXPORT_TOKEN); none is in
//     this repo's Actions secrets. The export covers the last 1-3 days only, so
//     each weekly run reports a 3-day window, labelled as such.
//   - Cloudflare Web Analytics: the beacon is on every page, but its RUM dataset
//     keeps the path without the query string, so utm_content cannot come from it.
//   - Google Search Console (GSC_SERVICE_ACCOUNT_JSON): search clicks only; it never
//     sees a Pinterest referral.
// With no readable source this writes the NAMED STOP PINTEREST_METRICS_UNAVAILABLE
// and exits 0 (a named stop, not a failure), never a zero it did not measure.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'reports/pinterest');
const LATEST = path.join(OUT_DIR, 'metrics.json');
const HISTORY = path.join(OUT_DIR, 'metrics_history.json');
const now = new Date().toISOString();
const queue = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/pinterest/queue.json'), 'utf8'));
const variantIds = new Set(queue.variants.map((v) => v.id));

function write(result) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LATEST, `${JSON.stringify(result, null, 2)}\n`);
  const history = fs.existsSync(HISTORY) ? JSON.parse(fs.readFileSync(HISTORY, 'utf8')) : [];
  history.push({ generated_at: result.generated_at, status: result.status, window: result.window ?? null, total: result.total ?? null, by_variant: result.by_variant ?? null });
  fs.writeFileSync(HISTORY, `${JSON.stringify(history.slice(-104), null, 2)}\n`);
  const line = result.status === 'MEASURED'
    ? `pinterest metrics: ${result.total} Pinterest-referred session(s) in ${result.window}, ${Object.keys(result.by_variant).length} variant(s) with visits`
    : `NAMED STOP: ${result.stop} - ${result.reason}`;
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Pinterest drip metrics\n\n${line}\n`);
}

function stop(reason, checked) {
  write({ generated_at: now, status: 'NAMED_STOP', stop: 'PINTEREST_METRICS_UNAVAILABLE', reason, checked });
  process.exit(0);
}

const checked = [
  'CLARITY_EXPORT_TOKEN (Clarity Data Export API)',
  'Cloudflare Web Analytics RUM (path only, no query string: cannot carry utm_content)',
  'Google Search Console (search clicks only: no Pinterest referrals)'
];
const token = process.env.CLARITY_EXPORT_TOKEN;
if (!token) stop('no readable analytics source carries utm_content: CLARITY_EXPORT_TOKEN is not set in this repo\'s Actions secrets, and Cloudflare Web Analytics and Search Console cannot see utm params.', checked);

const res = await fetch('https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=3&dimension1=URL', { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
if (!res.ok) stop(`Clarity Data Export API answered ${res.status}; nothing was measured.`, checked);
const body = await res.json();
const traffic = (Array.isArray(body) ? body : []).find((m) => m.metricName === 'Traffic');
const rows = traffic?.information ?? [];
if (!rows.length) stop('Clarity export returned no Traffic rows for the last 3 days; nothing was measured.', checked);
if (!rows.some((r) => String(r.URL ?? r.Url ?? '').includes('?'))) stop('Clarity export URLs carry no query strings, so utm_source/utm_content cannot be read from it.', checked);

const byVariant = {};
let total = 0;
for (const row of rows) {
  let url;
  try { url = new URL(String(row.URL ?? row.Url)); } catch { continue; }
  if (url.searchParams.get('utm_source') !== 'pinterest') continue;
  const sessions = Number(row.totalSessionCount ?? row.sessionsCount ?? 0);
  total += sessions;
  const id = url.searchParams.get('utm_content') ?? '(launch item, no utm_content)';
  byVariant[id] = (byVariant[id] ?? 0) + sessions;
}
write({
  generated_at: now,
  status: 'MEASURED',
  source: 'Microsoft Clarity Data Export API (project-live-insights, dimension URL)',
  window: 'last 3 days (the Clarity export maximum)',
  total,
  by_variant: byVariant,
  unknown_variants: Object.keys(byVariant).filter((id) => !variantIds.has(id) && !id.startsWith('('))
});
