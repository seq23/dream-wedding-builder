#!/usr/bin/env node
// Weekly entity watch (.github/workflows/entity-backlink-watch.yml).
//
// Fetches every sameAs and profiles_pending URL in data/seo/entity.json with a
// browser user agent, classifies it (scripts/entity/entity_watch_lib.mjs), applies
// the self-heal to entity.json (dead profiles out, newly resolving pending profiles
// in), and writes reports/entity/backlink_watch.json plus a human summary. The
// workflow turns a changed entity.json into a PR.
//
// Exit codes: 0 = every profile checked and either fine or healed; 2 = a NAMED STOP
// (a profile that resolves but does not link back: only the owner can edit it) or a
// profile that could not be reached; 1 = the watch itself could not run, including
// an entity.json with zero profiles to check - a watch that checked nothing has not passed.
import fs from 'node:fs';
import path from 'node:path';
import { classify, entityRecords, heal } from './entity_watch_lib.mjs';

const ROOT = process.cwd();
const ENTITY = path.join(ROOT, 'data/seo/entity.json');
const REPORT = path.join(ROOT, 'reports/entity/backlink_watch.json');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const dryRun = process.argv.includes('--dry-run');

async function fetchProfile(url) {
  try {
    const response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA, accept: 'text/html,*/*' }, signal: AbortSignal.timeout(20000) });
    const body = response.ok ? (await response.text()).slice(0, 2_000_000) : '';
    return { status: response.status, body };
  } catch (error) {
    return { status: null, body: '', error: String(error?.message || error) };
  }
}

const entity = JSON.parse(fs.readFileSync(ENTITY, 'utf8'));
const records = entityRecords(entity);
const urls = new Map();
for (const { record, linkHosts } of records) {
  for (const url of [...(record.sameAs ?? []), ...(record.profiles_pending ?? [])]) urls.set(url, linkHosts);
}
if (urls.size === 0) {
  console.error('[entity-watch] entity.json lists zero profiles (sameAs and profiles_pending both empty everywhere). A watch that checked nothing has not passed.');
  process.exit(1);
}

const results = new Map();
const detail = [];
for (const [url, linkHosts] of urls) {
  const fetched = await fetchProfile(url);
  const state = classify(url, fetched, linkHosts);
  results.set(url, state);
  detail.push({ url, status: fetched.status, error: fetched.error ?? null, state });
}
const outcome = heal(entity, results);

const report = {
  checked_at: new Date().toISOString(),
  profiles_checked: urls.size,
  results: detail,
  removed: outcome.removed, promoted: outcome.promoted,
  named_stops: outcome.stops.map((stop) => ({ ...stop, action: `Owner login: open ${stop.url} and add https://${stop.hosts[0]}/ in ${stop.field}.` })),
  unverifiable: outcome.unverifiable, unreachable: outcome.unreachable,
  entity_changed: outcome.changed
};
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n');
if (outcome.changed && !dryRun) fs.writeFileSync(ENTITY, JSON.stringify(outcome.entity, null, 2) + '\n');

const lines = [`Entity watch: ${urls.size} profile(s) checked.`];
for (const item of detail) lines.push(`- ${item.state.toUpperCase()} ${item.url} (${item.status ?? item.error})`);
for (const item of outcome.removed) lines.push(`- HEALED: removed dead ${item.url} from ${item.key}.sameAs`);
for (const item of outcome.promoted) lines.push(`- HEALED: promoted ${item.url} from ${item.key}.profiles_pending into sameAs`);
for (const stop of report.named_stops) lines.push(`- NAMED STOP (${stop.key}): ${stop.action}`);
for (const item of outcome.unreachable) lines.push(`- UNREACHABLE (${item.key}): ${item.url} - kept; it is removed only when it answers 404/410.`);
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
process.exit(outcome.stops.length || outcome.unreachable.length ? 2 : 0);
