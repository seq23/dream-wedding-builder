#!/usr/bin/env node
// Weekly Pinterest measurement for the daily drip: Pinterest-referred visits
// (utm_source=pinterest) per pin variant (utm_content), written to
// reports/pinterest/metrics.json and appended to reports/pinterest/metrics_history.json.
//
// Source: the site's OWN page-view log, D1 table pinterest_visits, written at the
// edge by worker.ts -> lib/pinterest-visits.ts (day, utm_content, path, counter; no
// IP, no user agent). Read through the Cloudflare D1 query API with the repo's
// CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID secrets.
// Why not the others (checked 16 Oct 2026): Cloudflare Web Analytics keeps the path
// without the query string; Clarity's export needs a token this repo lacks and covers
// 3 days; Search Console never sees a Pinterest referral.
// With the log unreadable this writes the NAMED STOP PINTEREST_METRICS_UNAVAILABLE
// and exits 0 (a named stop, not a failure), never a zero it did not measure.
// The count covers every whole day since the last count (lib/pinqueue.mjs countWindow),
// not a fixed 7 days: the 1 Nov move to Saturdays left 27-30 Oct outside every week.
import fs from 'node:fs';
import path from 'node:path';
import { countWindow } from '../../lib/pinqueue.mjs';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'reports/pinterest');
const LATEST = path.join(OUT_DIR, 'metrics.json');
const HISTORY = path.join(OUT_DIR, 'metrics_history.json');
const now = new Date().toISOString();
const queue = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/pinterest/queue.json'), 'utf8'));
const variantIds = new Set([...queue.variants, ...(queue.questions ?? [])].map((v) => v.id));

function write(result) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(LATEST, `${JSON.stringify(result, null, 2)}\n`);
  const history = fs.existsSync(HISTORY) ? JSON.parse(fs.readFileSync(HISTORY, 'utf8')) : [];
  history.push({ generated_at: result.generated_at, status: result.status, window: result.window ?? null, window_from: result.window_from ?? null, window_to: result.window_to ?? null, total: result.total ?? null, pins_released: result.pins_released ?? null, sales: result.sales ?? null, signups: result.signups ?? null, by_variant: result.by_variant ?? null });
  fs.writeFileSync(HISTORY, `${JSON.stringify(history.slice(-104), null, 2)}\n`);
  const line = result.status === 'MEASURED'
    ? `pinterest metrics: ${result.pins_released} pin(s) released, ${result.total} Pinterest-referred visit(s), ${result.sales} sale(s), ${result.signups} signup(s) in ${result.window}; ${Object.keys(result.by_variant).length} pin(s) with visits`
    : `NAMED STOP: ${result.stop} - ${result.reason}`;
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Pinterest drip metrics\n\n${line}\n`);
}

function stop(reason, checked) {
  write({ generated_at: now, status: 'NAMED_STOP', stop: 'PINTEREST_METRICS_UNAVAILABLE', reason, checked });
  process.exit(0);
}

const DB_ID = 'bba7a944-4afa-4d36-9f54-b222a2b0428e'; // wrangler.jsonc d1_databases[DB]
const checked = ['D1 pinterest_visits (own edge page-view log) via the Cloudflare D1 query API'];
const { CLOUDFLARE_API_TOKEN: cfToken, CLOUDFLARE_ACCOUNT_ID: account } = process.env;
if (!cfToken || !account) stop('CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID are not set in this repo\'s Actions secrets, so the D1 pinterest_visits log cannot be read.', checked);

const today = new Date(now).toISOString().slice(0, 10);
const span = countWindow(fs.existsSync(HISTORY) ? JSON.parse(fs.readFileSync(HISTORY, 'utf8')) : [], today);
if (!span) {
  console.log(`pinterest metrics: nothing to count - the last count already covers every whole day before ${today}`);
  process.exit(0);
}
const { from: since, to: until } = span;
async function query(sql, params = []) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${DB_ID}/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${cfToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ sql, params })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) stop(`Cloudflare D1 query API answered ${res.status} (${(body.errors ?? []).map((e) => e.code).join(',') || 'no error code'}); nothing was measured.`, checked);
  return body.result?.[0]?.results ?? [];
}
await query(`CREATE TABLE IF NOT EXISTS pinterest_visits (day TEXT NOT NULL, utm_content TEXT NOT NULL, path TEXT NOT NULL, visits INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, utm_content, path))`);
const rows = await query('SELECT utm_content, SUM(visits) AS visits FROM pinterest_visits WHERE day >= ? AND day <= ? GROUP BY utm_content', [since, until]);
// Sales and planner signups by visitors who arrived from a pin (lib/pinterest-conversions.ts).
await query(`CREATE TABLE IF NOT EXISTS pinterest_conversions (day TEXT NOT NULL, utm_content TEXT NOT NULL, kind TEXT NOT NULL, ref TEXT NOT NULL, PRIMARY KEY (kind, ref))`);
const conv = Object.fromEntries((await query('SELECT kind, COUNT(*) AS n FROM pinterest_conversions WHERE day >= ? AND day <= ? GROUP BY kind', [since, until])).map((r) => [r.kind, Number(r.n ?? 0)]));
// Pins released in the window: drip variants and question pins (queue.json release dates).
const pinsReleased = [...queue.variants, ...(queue.questions ?? [])].filter((v) => v.release_date && v.release_date >= since && v.release_date <= until).length;

const byVariant = {};
let total = 0;
for (const row of rows) {
  const n = Number(row.visits ?? 0);
  total += n;
  byVariant[row.utm_content] = n;
}
write({
  generated_at: now,
  status: 'MEASURED',
  source: 'D1 pinterest_visits (own edge page-view log, lib/pinterest-visits.ts)',
  window: `${span.days} day(s), ${since} to ${until}`,
  window_from: since,
  window_to: until,
  total,
  pins_released: pinsReleased,
  sales: conv.sale ?? 0,
  signups: conv.signup ?? 0,
  by_variant: byVariant,
  unknown_variants: Object.keys(byVariant).filter((id) => !variantIds.has(id) && !id.startsWith('('))
});
