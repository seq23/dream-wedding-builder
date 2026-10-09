#!/usr/bin/env node
// POST-DEPLOY CHECK: the live Worker carries every cron schedule wrangler.jsonc
// declares. Runs as the last step of `npm run deploy` (the Workers Builds
// production deploy command), so a deploy that leaves the hourly delivery retry
// unscheduled turns the Workers Builds check red instead of passing silently.
//
// Incident 2026-10-09 (PR #24): the 06:00 UTC run did not fire after the deploy.
// The deploy HAD registered the schedule (Cloudflare reports it created at
// 05:48:09, two seconds after the deployment); a newly created cron trigger takes
// up to 15 minutes to propagate, and 06:00 fell inside that window. The 07:00 run
// fired. Nothing here can speed propagation up; what this check does guarantee is
// that a deploy which did NOT register the schedule (a dashboard switch to
// `wrangler versions upload`, a dropped "triggers" block) cannot pass.
//
// Read-only: one GET of /workers/scripts/<name>/schedules.
// Credentials: CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (Workers Builds sets
// both in the build environment); a local run falls back to wrangler's own login.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function readWranglerConfig(root = process.cwd()) {
  const raw = fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8');
  return JSON.parse(raw.replace(/^\s*\/\/.*$/gm, ''));
}

// Returns a list of problems; empty means the live schedule covers the config.
export function compareSchedules(expected, live) {
  const problems = [];
  if (!Array.isArray(expected) || expected.length === 0) {
    problems.push('wrangler.jsonc declares no triggers.crons, but worker.ts has a scheduled handler: 0 schedules to check is a failure, not a pass');
    return problems;
  }
  const liveCrons = new Set((live ?? []).map((s) => String(s.cron).trim()));
  for (const cron of expected) {
    if (!liveCrons.has(cron.trim())) problems.push(`cron "${cron}" is in wrangler.jsonc but NOT on the live Worker (live: ${liveCrons.size ? [...liveCrons].join(', ') : 'none'})`);
  }
  return problems;
}

function credentials() {
  if (process.env.CLOUDFLARE_API_TOKEN) return { token: process.env.CLOUDFLARE_API_TOKEN, source: 'CLOUDFLARE_API_TOKEN' };
  for (const file of [path.join(os.homedir(), '.wrangler/config/default.toml'), path.join(os.homedir(), 'Library/Preferences/.wrangler/config/default.toml')]) {
    if (!fs.existsSync(file)) continue;
    const m = /^oauth_token\s*=\s*"([^"]+)"/m.exec(fs.readFileSync(file, 'utf8'));
    if (m) return { token: m[1], source: 'wrangler login' };
  }
  return null;
}

async function api(token, url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) throw new Error(`GET ${url.replace(/accounts\/[^/]+/, 'accounts/<id>')} -> HTTP ${res.status} ${JSON.stringify(body.errors ?? [])}`);
  return body.result;
}

async function main() {
  const config = readWranglerConfig();
  const expected = config.triggers?.crons ?? [];
  const name = config.name;
  const empty = compareSchedules(expected, []);
  if (expected.length === 0) { console.error(`live cron: FAIL ${empty[0]}`); process.exit(1); }

  const cred = credentials();
  if (!cred) { console.error('live cron: FAIL no Cloudflare credentials (CLOUDFLARE_API_TOKEN unset and no wrangler login), so the live schedule cannot be confirmed'); process.exit(1); }
  const base = 'https://api.cloudflare.com/client/v4';
  let account = process.env.CLOUDFLARE_ACCOUNT_ID || config.account_id;
  if (!account) {
    const accounts = await api(cred.token, `${base}/accounts`);
    if (accounts.length !== 1) { console.error(`live cron: FAIL set CLOUDFLARE_ACCOUNT_ID (${accounts.length} accounts visible)`); process.exit(1); }
    account = accounts[0].id;
  }

  // The schedules endpoint can trail the deployment by a second or two; three
  // reads, 5 s apart, before calling it missing.
  let problems = [];
  let live = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    live = (await api(cred.token, `${base}/accounts/${account}/workers/scripts/${name}/schedules`)).schedules ?? [];
    problems = compareSchedules(expected, live);
    if (problems.length === 0) break;
    if (attempt < 3) await new Promise((r) => setTimeout(r, 5000));
  }
  if (problems.length) {
    for (const p of problems) console.error(`  FAIL ${p}`);
    console.error(`live cron: FAIL ${name} is deployed without its cron schedule. The deploy command must be one that applies wrangler.jsonc triggers (\`wrangler deploy\` via \`npm run deploy\`), not \`wrangler versions upload\`. Re-apply with \`npx wrangler triggers deploy\`.`);
    process.exit(1);
  }
  const detail = live.map((s) => `${s.cron} (modified ${s.modified_on})`).join(', ');
  console.log(`live cron: PASS ${name} schedules [${detail}] cover wrangler.jsonc [${expected.join(', ')}] via ${cred.source}. New schedules take up to 15 min to start firing.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => { console.error(`live cron: FAIL ${error.message}`); process.exit(1); });
}
