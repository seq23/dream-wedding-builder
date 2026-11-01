#!/usr/bin/env node
/**
 * THE SPRY LABS WEEKLY HAND-OFF for Dream Wedding (owner, 1 Nov 2026). This repo sends no weekly
 * email. On Wednesday morning it writes spry-weekly-summary.json (schema spry-weekly-summary-v1) and
 * .github/workflows/spry-weekly-summary.yml uploads it as the artifact `spry-weekly-summary`. Boss OS
 * reads the newest one at 08:15 Central and puts one short section for Dream Wedding into the one
 * "Spry Labs weekly" email.
 *
 * Four real numbers, each from something this repo already records:
 *   1. Sales: paid orders in the last 7 days (D1 `orders`, written by the Stripe webhook).
 *   2. Search: Google Search Console clicks and impressions per site,
 *      data/search_intelligence/gsc_truth.json (the rolling 28-day window, per host).
 *   3. Pinterest: visits from pins, reports/pinterest/metrics.json (Saturday's pinterest-drip run).
 *   4. Pages: guides new in data/authority/content_registry.json against 7 days ago (git history),
 *      and pages the refresh lane refreshed (data/cadence/refresh_lane_ledger.json).
 *
 * RULE 0: a number that could not be read is the line "<what>: not read: <reason>", never a zero.
 * If not one of the four could be read the script refuses (NAMED STOP), so Boss OS says the report
 * did not arrive instead of carrying four empty lines.
 *
 *   node scripts/spry/spry-weekly-summary.mjs [out.json]      # needs CLOUDFLARE_API_TOKEN/ACCOUNT_ID for sales
 *   node scripts/spry/spry-weekly-summary.mjs --self-check
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

export const SCHEMA = 'spry-weekly-summary-v1';
const DB_ID = 'bba7a944-4afa-4d36-9f54-b222a2b0428e'; // wrangler.jsonc d1_databases[DB], as scripts/pinterest/collect_metrics.mjs
const DAY = 86_400_000;
const STALE_SEARCH_DAYS = 8;
const STALE_PINTEREST_DAYS = 10;

const day = (iso) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' });
const plural = (k, one, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;
const notRead = (what, reason) => ({ read: false, line: `${what}: not read: ${reason}.` });
const searchFresh = (h, now) => h?.complete === true && h.totals?.clicks != null && now - Date.parse(h.collected_at ?? '') <= STALE_SEARCH_DAYS * DAY;

/** Sales line from `{ paid }` or `{ error }`. */
export function salesLine(sales) {
  if (!sales || sales.error) return notRead('Sales', sales?.error ?? 'nothing was asked');
  return { read: true, line: `Sales: ${plural(sales.paid, 'paid order')} this week.` };
}

/** Search line from gsc_truth.json, summed over the sites whose window is complete and fresh. */
export function searchLine(gsc, now) {
  const hosts = Object.entries(gsc?.hosts ?? {});
  if (!hosts.length) return notRead('Search', 'no Search Console record in this repo');
  const fresh = hosts.filter(([, h]) => searchFresh(h, now));
  if (!fresh.length) return notRead('Search', 'no site has a complete Search Console window from the last week');
  const clicks = fresh.reduce((a, [, h]) => a + Number(h.totals.clicks), 0);
  const shown = fresh.reduce((a, [, h]) => a + Number(h.totals.impressions ?? 0), 0);
  const end = fresh.map(([, h]) => h.period?.end).filter(Boolean).sort().at(-1);
  const left = hosts.length - fresh.length;
  return {
    read: true,
    line: `Search (Google, 28 days${end ? ` to ${day(`${end}T12:00:00Z`)}` : ''}): ${plural(clicks, 'click')}, shown in results ${shown === 1 ? 'once' : `${shown} times`}, across ${plural(fresh.length, 'site')}${left ? ` (${left} not read)` : ''}.`,
  };
}

/** Pinterest line from reports/pinterest/metrics.json. */
export function pinterestLine(pin, now) {
  if (!pin) return notRead('Pinterest', 'no Pinterest measurement in this repo');
  if (pin.status !== 'MEASURED') return notRead('Pinterest', String(pin.reason ?? pin.stop ?? 'the last measurement stopped').replace(/\.$/, ''));
  const at = Date.parse(pin.generated_at ?? '');
  if (Number.isNaN(at) || now - at > STALE_PINTEREST_DAYS * DAY) return notRead('Pinterest', `the newest measurement is from ${Number.isNaN(at) ? 'an unknown day' : day(at)}`);
  if (pin.total == null) return notRead('Pinterest', 'the measurement holds no total');
  return { read: true, line: `Pinterest (week to ${day(at)}): ${plural(Number(pin.total), 'visit')} from pins.` };
}

/** Pages line from the guide count now vs 7 days ago, and the refresh lane's runs. */
export function pagesLine({ guidesNow, guidesBefore, refresh }, now) {
  const since = new Date(now - 7 * DAY).toISOString().slice(0, 10);
  const parts = [];
  if (guidesNow == null || guidesBefore == null) parts.push('new guides not read: no registry from a week ago');
  else parts.push(`${plural(Math.max(0, guidesNow - guidesBefore), 'new guide')} published`);
  if (!Array.isArray(refresh?.runs)) parts.push('refreshes not read: no refresh ledger');
  else parts.push(`${plural(refresh.runs.filter((r) => String(r.at) > since).reduce((a, r) => a + Number(r.refreshed ?? 0), 0), 'page')} refreshed`);
  const read = parts.filter((p) => !p.includes('not read')).length;
  if (!read) return notRead('Pages', 'neither the guide registry history nor the refresh ledger could be read');
  return { read: true, line: `Pages this week: ${parts.join('; ')}.` };
}

/** The summary Boss OS reads. Throws NAMED STOP when nothing at all was read. */
export function buildSummary({ sales, gsc, pin, pages, now = Date.now(), runUrl = null }) {
  const lines = [salesLine(sales), searchLine(gsc, now), pinterestLine(pin, now), pagesLine(pages ?? {}, now)];
  if (!lines.some((l) => l.read)) throw new Error('NAMED STOP [NOTHING_READ] not one of sales, search, Pinterest or pages could be read; nothing to hand to Boss OS.');
  const sites = Object.entries(gsc?.hosts ?? {}).map(([host, h]) => ({
    host, label: host, state: searchFresh(h, now) ? 'fine' : 'watch', why: searchFresh(h, now) ? [] : ['Search Console could not be read for this site this week'],
  }));
  return {
    schema: SCHEMA, business: 'Dream Wedding', week: new Date(now).toISOString().slice(0, 10),
    generated_at: new Date(now).toISOString(), run_url: runUrl, sites, notes: lines.map((l) => l.line),
  };
}

const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null);
const guideCount = (registry) => (Array.isArray(registry?.pages) ? registry.pages.length : null);

/** The guide registry as it stood 7 days ago, from git history (the workflow fetches it all). */
function registryWeekAgo(now) {
  const since = new Date(now - 7 * DAY).toISOString();
  const rev = spawnSync('git', ['rev-list', '-1', `--before=${since}`, 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  if (!rev) return null;
  const r = spawnSync('git', ['show', `${rev}:data/authority/content_registry.json`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 ? JSON.parse(r.stdout) : null;
}

/** Paid orders from D1 through the Cloudflare D1 query API; `{ error }` when it cannot be read. */
async function readSales(now) {
  const { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: account } = process.env;
  if (!token || !account) return { error: 'the Cloudflare credentials are not set for this run' };
  const since = new Date(now - 7 * DAY).toISOString().replace('T', ' ').slice(0, 19); // orders.created_at is CURRENT_TIMESTAMP (UTC, space-separated)
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${DB_ID}/query`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: "SELECT COUNT(*) AS n FROM orders WHERE status = 'PAID' AND created_at >= ?", params: [since] }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success) return { error: `the database answered ${res.status}` };
    return { paid: Number(body.result?.[0]?.results?.[0]?.n ?? 0) };
  } catch (e) {
    return { error: `the database could not be reached (${String(e?.message ?? e).slice(0, 80)})` };
  }
}

/** Proves the hand-off before CI trusts it: numbers read become lines, unread ones say so, none refuses. */
export function selfCheck() {
  const now = Date.parse('2026-11-04T13:00:00Z');
  const host = (clicks, impressions, collected = '2026-11-03T11:45:00Z') => ({ complete: true, collected_at: collected, period: { end: '2026-11-01' }, totals: { clicks, impressions } });
  const full = buildSummary({
    now, sales: { paid: 1 },
    gsc: { hosts: { 'a.example': host(1, 6), 'b.example': host(0, 4) } },
    pin: { status: 'MEASURED', generated_at: '2026-10-31T11:00:00Z', total: 2 },
    pages: { guidesNow: 91, guidesBefore: 89, refresh: { runs: [{ at: '2026-11-01', refreshed: 3 }, { at: '2026-10-20', refreshed: 9 }] } },
  });
  const want = ['Sales: 1 paid order this week.', 'Search (Google, 28 days to Nov 1): 1 click, shown in results 10 times, across 2 sites.', 'Pinterest (week to Oct 31): 2 visits from pins.', 'Pages this week: 2 new guides published; 3 pages refreshed.'];
  if (full.schema !== SCHEMA || JSON.stringify(full.notes) !== JSON.stringify(want) || full.sites.some((s) => s.state !== 'fine')) throw new Error(`self-check: lines are wrong: ${JSON.stringify(full.notes)}`);
  const part = buildSummary({ now, sales: { error: 'the Cloudflare credentials are not set for this run' }, gsc: { hosts: { 'a.example': host(5, 9, '2026-10-01T00:00:00Z') } }, pin: { status: 'NAMED_STOP', reason: 'D1 unreadable.' }, pages: { refresh: { runs: [] } } });
  if (!part.notes.every((l, i) => i === 3 || l.includes('not read')) || part.notes.some((l) => /\b0 (paid|click|visit)/.test(l)) || part.sites[0].state !== 'watch') throw new Error(`self-check: an unread number became a zero or vanished: ${JSON.stringify(part.notes)}`);
  let refused = false;
  try { buildSummary({ now, sales: { error: 'x' }, gsc: null, pin: null, pages: {} }); } catch { refused = true; }
  if (!refused) throw new Error('self-check: a summary with nothing read was handed on (rule 0)');
  console.log('spry-weekly-summary self-check: ok');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv[2] === '--self-check') selfCheck();
  else {
    const out = process.argv[2] ?? 'spry-weekly-summary.json';
    const now = Date.now();
    const summary = buildSummary({
      now, runUrl: process.env.RUN_URL ?? null, sales: await readSales(now),
      gsc: readJson('data/search_intelligence/gsc_truth.json'), pin: readJson('reports/pinterest/metrics.json'),
      pages: { guidesNow: guideCount(readJson('data/authority/content_registry.json')), guidesBefore: guideCount(registryWeekAgo(now)), refresh: readJson('data/cadence/refresh_lane_ledger.json') },
    });
    fs.writeFileSync(out, `${JSON.stringify(summary, null, 2)}\n`);
    for (const l of summary.notes) console.log(`  ${l}`);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Spry Labs weekly: Dream Wedding\n\n${summary.notes.map((l) => `- ${l}`).join('\n')}\n`);
    console.log(`spry weekly summary -> ${out}`);
  }
}
