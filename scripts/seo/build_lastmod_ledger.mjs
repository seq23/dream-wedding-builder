#!/usr/bin/env node
// Builds data/seo/lastmod_ledger.json: the real last-content-change date for every
// path the sitemaps publish.
//
// Why a committed ledger rather than a lookup at request time: the site runs on
// Cloudflare Workers via OpenNext. There is no git and no filesystem in that
// runtime, so the dates have to be resolved ahead of time and shipped as data.
//
// How the date is derived, and why it is deterministic. For each path we compute a
// fingerprint of the content that actually renders it, then walk that content's
// committed history newest-first for as long as the fingerprint is unchanged. The
// oldest commit in that unbroken run is the commit that introduced the content
// currently on the page, and its commit date is the honest lastmod. The answer
// depends only on committed history, so it is identical on any machine on any day,
// and it does not move when an unrelated file is touched.
//
// The one case that cannot come from history is content that is not committed yet:
// full-safe-autonomy.yml generates guides and then commits them, so on that run the
// new pages have no commit to point at. Those, and only those, take the run date,
// supplied by LASTMOD_RUN_AT or AUTHORITY_RUN_AT so the workflow can pin it. Once
// committed they resolve from history like everything else and stop moving.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { isComplete } from '../../lib/authority-complete.mjs';

const root = process.cwd();
const REGISTRY = 'data/authority/content_registry.json';
const HUBS = 'data/seo/hub_pages.json';
const CATALOG = 'data/products/product_catalog.json';
const OWNERSHIP = 'data/seo/route_ownership.json';
const OUT = 'data/seo/lastmod_ledger.json';

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');

// Stable key order so a formatting-only rewrite of the JSON is not read as a
// content change.
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
const fingerprint = (value) => (value === undefined ? null : sha(JSON.stringify(stable(value))));

const runAt = (process.env.LASTMOD_RUN_AT || process.env.AUTHORITY_RUN_AT || new Date().toISOString()).slice(0, 10);

// A shallow clone has no history to walk, so every path would fall through to
// "uncommitted" and take the run date - 103 URLs stamped with one identical
// date, which is the fabricated freshness signal this file exists to remove.
// That is exactly what the daily lane committed on 2026-08-27 under the default
// depth-1 actions/checkout. Refuse instead of producing it: this is a
// misconfigured checkout, not a content state.
if (git('rev-parse', '--is-shallow-repository').trim() === 'true') {
  console.error('LASTMOD LEDGER: refusing to build from a shallow clone. Every lastmod would collapse to today. Check out with fetch-depth: 0.');
  process.exit(1);
}

// Commit list per file, newest first, plus that file's blob at each commit.
const historyCache = new Map();
function history(file) {
  if (historyCache.has(file)) return historyCache.get(file);
  const log = git('log', '--format=%H %cI', '--', file).trim();
  const commits = log ? log.split('\n').map((line) => { const [hash, date] = line.split(' '); return { hash, date: date.slice(0, 10) }; }) : [];
  historyCache.set(file, commits);
  return commits;
}

const blobCache = new Map();
function blobAt(commit, file) {
  const key = `${commit}:${file}`;
  if (blobCache.has(key)) return blobCache.get(key);
  let value = null;
  try { value = git('show', `${commit}:${file}`); } catch { value = null; }
  blobCache.set(key, value);
  return value;
}

/**
 * Walks history newest-first while `extract` yields the same fingerprint as the
 * working tree, and returns the date of the oldest commit in that unbroken run.
 * Returns null when the current content appears in no commit, which means it is
 * uncommitted.
 */
function lastChanged(file, extract) {
  const current = fingerprint(extract(readJson(file)));
  if (current === null) return null;
  const commits = history(file);
  let answer = null;
  for (const commit of commits) {
    const blob = blobAt(commit.hash, file);
    if (blob === null) break;
    let parsed;
    try { parsed = JSON.parse(blob); } catch { break; }
    if (fingerprint(extract(parsed)) !== current) break;
    answer = commit.date;
  }
  return answer;
}

/**
 * Removes the document-head declarations from a route file before fingerprinting.
 *
 * lastmod is a claim about the content a reader sees. Adding a canonical tag or
 * rewording a meta description changes the file but changes nothing on the page, and
 * counting it would restamp a legal page nobody has edited since May as "changed
 * today" - the same false freshness this ledger exists to remove. Only the imports
 * that exist to feed the metadata block are dropped, so a real component import still
 * registers as a change.
 */
function stripHeadMetadata(source) {
  const lines = source.split('\n');
  const kept = [];
  let depth = 0;
  let skipping = false;
  for (const line of lines) {
    if (!skipping && /^\s*import\s+\{[^}]*\b(seoMetadata|hubMetadata|guideMetadata|PARENT_HOST)\b[^}]*\}\s+from/.test(line)) continue;
    if (!skipping && /^\s*import\s+type\s+\{\s*Metadata\s*\}\s+from/.test(line)) continue;
    if (!skipping && /^\s*export\s+(const\s+metadata\b|async\s+function\s+generateMetadata\b|function\s+generateMetadata\b)/.test(line)) { skipping = true; depth = 0; }
    if (skipping) {
      for (const char of line) { if (char === '{' || char === '(') depth++; else if (char === '}' || char === ')') depth--; }
      if (depth <= 0) skipping = false;
      continue;
    }
    kept.push(line);
  }
  return kept.join('\n');
}

/** Same walk, for a path whose content is a source file rather than a data entry. */
function fileLastChanged(file) {
  if (!fs.existsSync(path.join(root, file))) return null;
  const normalize = (text) => sha(file.endsWith('.tsx') ? stripHeadMetadata(text) : text);
  const current = normalize(fs.readFileSync(path.join(root, file), 'utf8'));
  let answer = null;
  for (const commit of history(file)) {
    const blob = blobAt(commit.hash, file);
    if (blob === null || normalize(blob) !== current) break;
    answer = commit.date;
  }
  return answer;
}

const newest = (...dates) => dates.filter(Boolean).sort().pop() ?? null;

const registry = readJson(REGISTRY);
const hubs = readJson(HUBS);
const catalog = readJson(CATALOG);
const ownership = readJson(OWNERSHIP);

// The registry's own updated_at is bookkeeping, not content. Excluding it keeps a
// stamped-but-unchanged page from claiming freshness it does not have.
const registryEntry = (slug) => (doc) => { const page = (doc.pages ?? []).find((item) => item.slug === slug); if (!page) return undefined; const { updated_at, ...content } = page; return content; };

const entries = {};
const uncommitted = [];
function record(pathname, date, source) {
  if (!date) { uncommitted.push(pathname); date = runAt; source = `${source} (uncommitted at generation; pinned to run date)`; }
  entries[pathname] = { lastmod: date, source };
}

// Data-backed paths date from their own record only, never from the template that
// renders them. Folding in the template date would have republished all 67 guides
// as "changed today" the moment anyone refactored app/guides/[slug]/page.tsx,
// which is precisely the false freshness signal this ledger exists to remove. A
// template edit that does change what readers see belongs in the record.
for (const page of registry.pages ?? []) record(`/guides/${page.slug}`, lastChanged(REGISTRY, registryEntry(page.slug)), `${REGISTRY}#pages[slug=${page.slug}]`);

for (const slug of Object.keys(hubs.pages ?? {})) record(`/${slug}`, lastChanged(HUBS, (doc) => doc.pages?.[slug]), `${HUBS}#pages.${slug}`);

for (const product of catalog.products ?? []) {
  const staticRoute = `app/products/${product.id}/page.tsx`;
  if (fs.existsSync(path.join(root, staticRoute))) { record(`/products/${product.id}`, fileLastChanged(staticRoute), staticRoute); continue; }
  record(`/products/${product.id}`, lastChanged(CATALOG, (doc) => (doc.products ?? []).find((item) => item.id === product.id)), `${CATALOG}#products[id=${product.id}]`);
}

// Everything else route_ownership.json publishes, backed by its own source file.
const routeFile = (pathname) => (pathname === '/' ? 'app/page.tsx' : `app/${pathname.replace(/^\//, '')}/page.tsx`);
for (const route of ownership.routes ?? []) {
  if (entries[route.path]) continue;
  // Page file only. A layout is shared chrome, not this route's content, and for
  // /free-wedding-planner and /photos the layout exists solely to hold metadata a client component
  // cannot export - dating the route from it would say those pages changed on the
  // day their canonical tag was added.
  record(route.path, fileLastChanged(routeFile(route.path)), routeFile(route.path));
}

// The guide index renders the shipping set, so it is as fresh as the newest guide
// it actually lists - not the newest skeleton sitting unlisted in the registry.
// isComplete() is imported, not mirrored: lib/authority-complete.mjs is plain ESM
// precisely so a Node build script and the router can call the same function.
const listedGuideDates = (registry.pages ?? []).filter(isComplete).map((page) => entries[`/guides/${page.slug}`]?.lastmod);
record('/guides', newest(fileLastChanged('app/guides/page.tsx'), ...listedGuideDates), 'app/guides/page.tsx + newest listed guide');

const doc = {
  schema_version: '1.0',
  policy: 'lastmod_derived_from_committed_content_change',
  method: 'For each path, the date of the oldest commit in the unbroken newest-first run of commits whose content fingerprint equals the current one - that is, the commit that introduced what the page shows now. Derived only from committed history, so it is reproducible and does not track checkout or build time. Paths whose content is not committed yet take the run date (LASTMOD_RUN_AT / AUTHORITY_RUN_AT) and settle once committed.',
  generated_from_commit: git('rev-parse', 'HEAD').trim(),
  // Cross-checked against lib/authority-registry.ts by tests/unit/lastmod-ledger.test.ts.
  shipping_guide_count: (registry.pages ?? []).filter(isComplete).length,
  paths: Object.fromEntries(Object.keys(entries).sort().map((key) => [key, entries[key]]))
};
fs.writeFileSync(path.join(root, OUT), JSON.stringify(doc, null, 2) + '\n');

const dates = Object.values(entries).map((entry) => entry.lastmod).sort();
console.log(JSON.stringify({ paths: dates.length, oldest: dates[0], newest: dates[dates.length - 1], uncommitted_pinned_to_run_date: uncommitted.length, distinct_dates: [...new Set(dates)].sort() }, null, 2));
