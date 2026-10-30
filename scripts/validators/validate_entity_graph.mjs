#!/usr/bin/env node
// validate:entity-graph - the data half of the entity check (the rendered half is
// tests/unit/entity-graph.test.ts, run by the same npm script, and the built-page
// half is scripts/validators/validate_rendered_seo_contract.mjs).
//
// data/seo/entity.json is the only place sameAs is written. This fails when:
//   - it describes zero sites, or its sites are not exactly route_ownership.json's hosts;
//   - any record lacks @id, name, url, logo or description, or its @id is not on its own host;
//   - any sameAs entry is not absolute https, is duplicated, points at one of this
//     repo's own hosts (a site listing itself, or a sibling, is not a profile), or is
//     also listed in profiles_pending;
//   - a site borrows a profile another record already claims (the 30 Oct 2026 defect:
//     three sites carried the checklist site's Pinterest as their own);
//   - the chain is not site -> brand -> Spry Labs, at the decided Spry Labs @id.
import fs from 'node:fs';

const SPRY_LABS_ID = 'https://billionairehighperformancecoach.com/spry-labs#organization';
const entity = JSON.parse(fs.readFileSync(process.argv[2] || 'data/seo/entity.json', 'utf8'));
const ownership = JSON.parse(fs.readFileSync('data/seo/route_ownership.json', 'utf8'));
const ownHosts = new Set([...Object.keys(ownership.hosts), ...Object.keys(ownership.alias_hosts ?? {})]);
const failures = [];
const fail = (message) => failures.push(message);
const hostOf = (url) => { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; } };

const sites = Object.entries(entity.sites ?? {});
if (sites.length === 0) fail('entity.json describes zero sites');
const expected = Object.keys(ownership.hosts).sort().join(',');
if (sites.map(([host]) => host).sort().join(',') !== expected) fail(`entity.json sites (${sites.map(([h]) => h).join(', ')}) are not route_ownership.json's hosts (${expected})`);

if (entity.spry_labs?.['@id'] !== SPRY_LABS_ID) fail(`spry_labs @id is ${entity.spry_labs?.['@id']}, not the decided entity home ${SPRY_LABS_ID}`);
if (entity.brand?.parentOrganization !== SPRY_LABS_ID) fail(`brand.parentOrganization is ${entity.brand?.parentOrganization}, not Spry Labs`);

const claimedBy = new Map();
let profiles = 0;
const records = [['brand', entity.brand, hostOf(entity.brand?.url)], ...sites.map(([host, record]) => [`sites.${host}`, record, host])];
for (const [key, record, host] of records) {
  if (!record) { fail(`${key} is missing`); continue; }
  for (const field of ['@id', 'name', 'url', 'logo', 'description']) if (!record[field] || typeof record[field] !== 'string') fail(`${key}.${field} is missing`);
  if (hostOf(record['@id']) !== host || hostOf(record.url) !== host) fail(`${key}: @id and url must be on ${host}`);
  if (!/^https:\/\//.test(record.logo || '') || hostOf(record.logo) !== host) fail(`${key}.logo must be an https URL on ${host}`);
  if (!Array.isArray(record.sameAs) || !Array.isArray(record.profiles_pending)) { fail(`${key}: sameAs and profiles_pending must both be arrays`); continue; }
  if (key !== 'brand' && record.parentOrganization !== entity.brand?.['@id']) fail(`${key}.parentOrganization is ${record.parentOrganization}, not the brand ${entity.brand?.['@id']}`);
  if (new Set(record.sameAs).size !== record.sameAs.length) fail(`${key}.sameAs lists a profile twice`);
  for (const url of record.sameAs) {
    profiles += 1;
    if (!/^https:\/\/[^\s"]+$/.test(url)) fail(`${key}.sameAs ${url} is not an absolute https URL`);
    if (ownHosts.has(hostOf(url))) fail(`${key}.sameAs ${url} points at this repo's own host ${hostOf(url)}: a site is not its own profile`);
    if (record.profiles_pending.includes(url)) fail(`${key}: ${url} is in both sameAs and profiles_pending`);
    if (claimedBy.has(url)) fail(`${key}.sameAs borrows ${url}, which ${claimedBy.get(url)} already claims; a shared profile belongs on the brand only`);
    else claimedBy.set(url, key);
  }
}
if (profiles === 0) fail('no record lists a single sameAs profile: the graph would claim nothing');

if (failures.length) {
  for (const message of failures) console.error(`[validate:entity-graph] ${message}`);
  process.exit(1);
}
console.log(`[validate:entity-graph] OK: ${sites.length} sites + brand, ${profiles} sameAs profile(s), chain site -> brand -> Spry Labs`);
