#!/usr/bin/env node
/*
 * REPO_IDENTITY.md MUST DECLARE EVERY DOMAIN THIS REPOSITORY SERVES, AND ONLY THOSE.
 *
 * Boss OS refuses to record a repair against a repository that does not declare the domain it
 * repaired (`src/worker/boss/routes/siteAudit.ts`: "a resemblance is not a mapping" - the portfolio
 * holds names as close as `dentistryguides` and `thedentistryguides`). Until 26 Oct 2026 this file
 * named no domain at all, so every finding against these four hosts was unmappable and no fix could
 * be recorded against it.
 *
 * The declaration is therefore load-bearing, which means it must not be allowed to drift from
 * `data/seo/route_ownership.json`, the file the Worker actually routes on. This check reads both and
 * fails when they disagree in either direction: a host added to the routing data and not declared, or
 * a host declared here that the Worker never serves.
 *
 * It also pins the root action of each canonical host, because that is the fact an outside auditor
 * gets wrong: a `/` that 308s to a product hub is deliberate, and a reviewer who deletes that
 * sentence as prose should fail this gate rather than invite the same false canonical brief back.
 */
import { readFileSync } from 'node:fs';

const identity = readFileSync(new URL('../REPO_IDENTITY.md', import.meta.url), 'utf8');
const ownership = JSON.parse(readFileSync(new URL('../data/seo/route_ownership.json', import.meta.url), 'utf8'));

const failures = [];

const section = identity.split(/^## Domains this repository serves$/m)[1];
if (!section) {
  console.error('FAIL identity-domains: REPO_IDENTITY.md has no "## Domains this repository serves" section.');
  process.exit(1);
}

// A declared host is a bullet whose first token is a bare domain.
const declared = [...section.matchAll(/^-\s+([a-z0-9][a-z0-9.-]*\.[a-z]{2,})\s+—/gm)].map((m) => m[1]);

const canonicalHosts = Object.keys(ownership.hosts);
const aliasHosts = Object.keys(ownership.alias_hosts ?? {});
const expected = [...canonicalHosts, ...aliasHosts];

for (const host of expected) {
  if (!declared.includes(host)) failures.push(`${host} is served (route_ownership.json) but REPO_IDENTITY.md does not declare it.`);
}
for (const host of declared) {
  if (!expected.includes(host)) failures.push(`REPO_IDENTITY.md declares ${host}, which route_ownership.json does not serve.`);
}

// The root action of every canonical host must be stated, so the redirect hosts cannot be mistaken
// for a canonical defect by anything reading this file.
for (const host of canonicalHosts) {
  const bullet = section.split('\n').find((line) => line.trim().startsWith(`- ${host} `));
  if (!bullet) continue;
  const cfg = ownership.hosts[host];
  if (cfg.root_action === 'redirect') {
    if (!bullet.includes(cfg.root_target)) failures.push(`${host} redirects / to ${cfg.root_target}; its line in REPO_IDENTITY.md does not say so.`);
    if (!/redirect/i.test(bullet)) failures.push(`${host} has root_action "redirect"; its line in REPO_IDENTITY.md does not call it a redirect.`);
  } else if (!/render/i.test(bullet)) {
    failures.push(`${host} renders / (root_action "${cfg.root_action}"); its line in REPO_IDENTITY.md does not say so.`);
  }
}

// The sentence that stops the false canonical brief coming back.
if (!/A `\/` that redirects is deliberate, not a canonical defect/.test(section)) {
  failures.push('The "A `/` that redirects is deliberate, not a canonical defect" paragraph is missing; it is why boss-os#150 exists.');
}

if (failures.length) {
  console.error(`FAIL identity-domains: ${failures.length} problem(s)`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`PASS identity-domains: ${declared.length} domains declared and matched to route_ownership.json (${canonicalHosts.length} canonical, ${aliasHosts.length} alias)`);
