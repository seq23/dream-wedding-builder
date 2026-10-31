#!/usr/bin/env node
// The committed artifacts/sitemaps/<host>.xml must list exactly the URLs the
// generator would emit from data/seo/route_ownership.json.
//
// Why: cadence_gate.js decides "new URL published into refresh debt" from these
// committed files. On 2026-10-30 PR #50 added /editorial-policy to all four
// hosts without regenerating them, so the PR's cadence gate compared stale
// sitemaps to the URL ledger, saw nothing new and passed; the next morning the
// scheduled authority lane regenerated the sitemaps, found four new URLs in a
// library 52% past its refresh window, and main went red with nothing able to
// clear it. Stale committed sitemaps make the PR-time gate blind; this closes it.
import fs from 'node:fs';
import { sitemapPathsByHost, locFor } from '../authority/sitemap-paths.mjs';

const root = process.argv[2] || '.';
const expected = sitemapPathsByHost(root);
const hosts = Object.keys(expected);
const problems = [];
let checked = 0;
if (hosts.length === 0) problems.push('route_ownership.json declares zero hosts; nothing was checked');
for (const host of hosts) {
  const file = `${root}/artifacts/sitemaps/${host}.xml`;
  if (!fs.existsSync(file)) { problems.push(`${file} is missing`); continue; }
  const have = new Set([...fs.readFileSync(file, 'utf8').matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]));
  const want = new Set(expected[host].map((p) => locFor(host, p)));
  if (want.size === 0) problems.push(`${host}: the generator emits zero URLs`);
  checked += want.size;
  for (const u of want) if (!have.has(u)) problems.push(`${host}: missing ${u}`);
  for (const u of have) if (!want.has(u)) problems.push(`${host}: lists ${u}, which route_ownership.json no longer emits`);
}
if (problems.length) {
  console.error(`[validate:sitemap-currency] FAIL: committed sitemaps differ from route_ownership.json (${problems.length}):`);
  for (const p of problems.slice(0, 20)) console.error(`  - ${p}`);
  console.error('  Repair: npm run authority:sitemaps, commit artifacts/sitemaps, then run npm run cadence:gate - a new URL while refresh debt is over tolerance blocks.');
  process.exit(1);
}
console.log(`[validate:sitemap-currency] OK: ${hosts.length} hosts, ${checked} URLs match the generator`);
