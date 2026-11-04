#!/usr/bin/env node
// Every engine-written question page's FIRST Organization in JSON-LD must be the
// complete one: name, url, logo and sameAs.
//
// Why: Search Readiness item c1 reads a page's first Organization node and fails
// when it lacks any of those four. The shared engine inlines a thin
// `{"@type":"Organization", name, url}` as the Article's author and publisher, and
// that node sits in the page graph ahead of the header's complete entity graph, so
// the thin copy is what an engine sees. On 3 November 2026 two pages were flagged
// "Organization lacks logo, sameAs" while data/seo/entity.json had both all along.
// scripts/seo/normalize_question_entity.mjs rewrites author/publisher to a
// reference; this is the gate that keeps it true, including for pages a newer
// engine version writes.
//
// The traversal deliberately mirrors boss-os
// src/shared/boss/searchReadiness/audit.mjs (jsonLd + deepNodes +
// organization_node): a validator that walked the graph differently could pass
// while the checklist the owner actually reads still failed.
import { readQuestionRetirements } from '../../lib/question-retirements.mjs';
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] || '.';
const dir = path.join(root, 'public/questions');
const REQUIRED = ['name', 'url', 'logo', 'sameAs'];
const ORG = /Organization|LocalBusiness|Corporation|NewsMediaOrganization|ProfessionalService/;

const typesOf = (n) => [].concat(n?.['@type'] ?? []).map(String);

/** Top-level typed nodes of every ld+json block, in document order. */
function jsonLdNodes(html) {
  const nodes = [];
  const errors = [];
  for (const m of String(html).matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (x) => {
        if (Array.isArray(x)) return x.forEach(walk);
        if (x && typeof x === 'object') { if (x['@graph']) walk(x['@graph']); if (x['@type']) nodes.push(x); }
      };
      walk(JSON.parse(m[1]));
    } catch (e) { errors.push(String(e.message).slice(0, 80)); }
  }
  return { nodes, errors };
}

/** Every node of a matching type, nested ones included, in traversal order. */
function deepNodes(nodes, re) {
  const out = [];
  const seen = new Set();
  const walk = (x) => {
    if (!x || typeof x !== 'object' || seen.has(x)) return;
    seen.add(x);
    if (Array.isArray(x)) return x.forEach(walk);
    if (typesOf(x).some((t) => re.test(t))) out.push(x);
    for (const v of Object.values(x)) if (v && typeof v === 'object') walk(v);
  };
  walk(nodes);
  return out;
}

const problems = [];
const pages = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.html')).sort() : [];
if (pages.length === 0) {
  try {
    const inventory = readQuestionRetirements(root);
    console.log(`[validate_question_entity] OK: ${inventory.count} retired questions resolve directly to ${inventory.targets.length} kept main-site destinations; publisher entity complete`);
  } catch (error) {
    console.error(`[validate_question_entity] FAIL: ${error.message}`);
    process.exit(1);
  }
  process.exit(0);
}

for (const file of pages) {
  const html = fs.readFileSync(path.join(dir, file), 'utf8');
  const { nodes, errors } = jsonLdNodes(html);
  if (errors.length) { problems.push(`${file}: JSON-LD does not parse (${errors[0]})`); continue; }
  const org = deepNodes(nodes, ORG)[0];
  if (!org) { problems.push(`${file}: no Organization in JSON-LD`); continue; }
  const miss = REQUIRED.filter((k) => !org[k] || (Array.isArray(org[k]) && org[k].length === 0));
  if (miss.length) problems.push(`${file}: the first Organization (${org['@id'] ?? 'no @id'}) lacks ${miss.join(', ')}`);
}

if (problems.length) {
  console.error(`[validate:question-entity] FAIL: ${problems.length} of ${pages.length} question page(s) lead with an incomplete Organization:`);
  for (const p of problems.slice(0, 20)) console.error(`  - ${p}`);
  console.error('  Repair: node scripts/seo/normalize_question_entity.mjs, then commit public/questions.');
  console.error('  Never add logo/sameAs to a page: data/seo/entity.json is the only place they are written.');
  process.exit(1);
}
console.log(`[validate:question-entity] OK: ${pages.length} question page(s) lead with a complete Organization (${REQUIRED.join(', ')})`);
