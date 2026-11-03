#!/usr/bin/env node
// Points every engine-written question page's Article at the one Organization
// record instead of inlining a thin copy of it.
//
// Why: the shared engine (seq23/search-loop src/render.mjs) builds the Article's
// `author` and `publisher` from search-loop.config.json's `publisher` block, which
// carries only a name and a url, so each page shipped an inline
// `{"@type":"Organization","name":...,"url":...}` with no logo and no sameAs. That
// inline node sits in the page graph on line 11, ahead of the header's complete
// entity graph, so an engine reading the page's first Organization sees the thin
// one: the Search Readiness check c1 ("Organization with name, url, logo and
// sameAs on every sampled page") failed on 3 November 2026 for
// /questions/free-wedding-planning-checklist-pdf and
// /questions/printable-wedding-checklist-free with "Organization lacks logo,
// sameAs". data/seo/entity.json is the only place logo and sameAs are written
// (lib/site-home.ts already emits publisher as {"@id": siteOrganizationId(host)}
// on every app route), so the fix is a reference, never a second copy.
//
// Runs in .github/scripts/search_loop_commit.sh between the engine's write and
// the commit, so a page the engine publishes tomorrow is corrected before it is
// committed, and is guarded by scripts/validators/validate_question_entity.mjs.
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] || '.';
const dir = path.join(root, 'public/questions');
const entity = JSON.parse(fs.readFileSync(path.join(root, 'data/seo/entity.json'), 'utf8'));
const brandId = entity?.brand?.['@id'];

if (!brandId) {
  console.error('[normalize:question-entity] FAIL: data/seo/entity.json has no brand["@id"] to point the pages at');
  process.exit(1);
}
if (!fs.existsSync(dir)) {
  console.error(`[normalize:question-entity] FAIL: ${dir} does not exist; the engine's output directory moved`);
  process.exit(1);
}

const pages = fs.readdirSync(dir).filter((f) => f.endsWith('.html')).sort();
// Rule 0: a run that looked at nothing must not exit 0.
if (pages.length === 0) {
  console.error(`[normalize:question-entity] FAIL: zero pages in ${dir}; nothing was normalized`);
  process.exit(1);
}

// Every ld+json block except the header's entity graph, which carries data-entity.
const BLOCK = /<script type="application\/ld\+json"(?![^>]*\bdata-entity=)[^>]*>([\s\S]*?)<\/script>/g;
const ARTICLE = /Article|BlogPosting|NewsArticle|WebPage|FAQPage|QAPage|CollectionPage/;

/** Replace an inline Organization on author/publisher with a reference to brandId. */
function pointAtBrand(node, changed) {
  for (const key of ['author', 'publisher']) {
    const v = node[key];
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    // A Person byline is a real byline, not a stand-in for the Organization.
    if (/Person/.test(String(v['@type'] ?? ''))) continue;
    if (!/Organization|Corporation|NewsMediaOrganization/.test(String(v['@type'] ?? ''))) continue;
    if (v['@id'] === brandId && Object.keys(v).length === 1) continue; // already a reference
    node[key] = { '@id': brandId };
    changed.push(`${key}`);
  }
}

function walk(x, changed) {
  if (Array.isArray(x)) { for (const v of x) walk(v, changed); return; }
  if (!x || typeof x !== 'object') return;
  if (ARTICLE.test(String(x['@type'] ?? ''))) pointAtBrand(x, changed);
  for (const v of Object.values(x)) walk(v, changed);
}

let rewritten = 0;
let seen = 0;
const problems = [];

for (const file of pages) {
  const p = path.join(dir, file);
  const before = fs.readFileSync(p, 'utf8');
  const changed = [];
  let blocks = 0;
  const after = before.replace(BLOCK, (whole, json) => {
    blocks += 1;
    let data;
    try { data = JSON.parse(json); } catch {
      problems.push(`${file}: a JSON-LD block is not valid JSON`);
      return whole;
    }
    const mine = [];
    walk(data, mine);
    if (mine.length === 0) return whole;
    changed.push(...mine);
    return whole.replace(json, JSON.stringify(data));
  });
  if (blocks === 0) { problems.push(`${file}: no page JSON-LD block`); continue; }
  seen += 1;
  if (after !== before) { fs.writeFileSync(p, after); rewritten += 1; }
}

if (problems.length) {
  console.error(`[normalize:question-entity] FAIL: ${problems.length} page(s) could not be normalized:`);
  for (const x of problems.slice(0, 20)) console.error(`  - ${x}`);
  process.exit(1);
}

console.log(`[normalize:question-entity] OK: ${seen} page(s) read, ${rewritten} rewritten to point author/publisher at ${brandId}`);
