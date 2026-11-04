#!/usr/bin/env node
// Every same-site link on an engine-written question page must resolve to
// something this repository actually serves.
//
// Why: the shared engine builds a related-questions link from the file's
// repository-relative path (src/site-index.mjs routeFor), so a page at
// public/questions/<slug>.html was linked as /public/questions/<slug>. `public/`
// is the Next.js web root, so the real route is /questions/<slug> and all 53 of
// those anchors - the site's entire "Related questions" navigation, across 18 of
// 21 pages - answered 404. A crawl of weddingchecklistpdf.com on 3 November 2026
// found the ten distinct dead URLs.
//
// validate:internal-links could not see it: that gate asks whether every SITEMAP
// URL has an inbound link, and these pages all did. Nothing asked the opposite
// question - whether every emitted anchor has a destination - which is why this
// gate exists rather than a wider rule in that one.
//
// scripts/seo/normalize_question_routes.mjs is the repair, and runs in
// .github/scripts/search_loop_commit.sh before the commit.
import { readQuestionRetirements } from '../../lib/question-retirements.mjs';
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] || '.';
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'search-loop.config.json'), 'utf8'));
const outDir = cfg?.output?.dir;
const prefix = cfg?.output?.url_prefix;
if (!outDir || !prefix) {
  console.error('[validate:question-links] FAIL: search-loop.config.json must declare output.dir and output.url_prefix');
  process.exit(1);
}
const dir = path.join(root, outDir);
const pages = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.html')).sort() : [];
if (pages.length === 0) {
  try {
    const inventory = readQuestionRetirements(root);
    console.log(`[validate_question_links] OK: ${inventory.count} retired questions resolve directly to ${inventory.targets.length} kept main-site destinations; publisher entity complete`);
  } catch (error) {
    console.error(`[validate_question_links] FAIL: ${error.message}`);
    process.exit(1);
  }
  process.exit(0);
}
const slugs = new Set(pages.map((f) => f.replace(/\.html$/, '')));
const hosts = new Set((cfg.allowed_link_targets || []).map((u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }).filter(Boolean));

const problems = [];
let checked = 0;

for (const file of pages) {
  const html = fs.readFileSync(path.join(dir, file), 'utf8');
  for (const m of html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)) {
    const raw = m[1];
    if (/^(#|mailto:|tel:|javascript:|data:)/i.test(raw)) continue;
    let p;
    if (/^https?:\/\//i.test(raw)) {
      let u;
      try { u = new URL(raw); } catch { problems.push(`${file}: href "${raw}" is not a URL`); continue; }
      if (!hosts.has(u.hostname.replace(/^www\./, ''))) continue; // a real outbound link is not ours to resolve
      p = u.pathname;
    } else if (raw.startsWith('/')) {
      p = raw.split(/[?#]/)[0];
    } else continue; // a relative href is a separate defect class, caught by the rendered-seo gate
    checked += 1;
    // `public/` is the web root: a route can never contain it.
    if (p === `/${outDir}` || p.startsWith(`/${outDir}/`)) {
      problems.push(`${file}: links to ${p} — "${outDir}" is the web root, so the served route is ${prefix}<slug>`);
      continue;
    }
    // A link into the questions section must name a page that exists.
    if (p.startsWith(prefix)) {
      const slug = p.slice(prefix.length).replace(/\/$/, '');
      if (slug && !slugs.has(slug)) problems.push(`${file}: links to ${p}, but ${outDir}/${slug}.html does not exist`);
    }
  }
}

if (checked === 0) {
  console.error('[validate:question-links] FAIL: zero same-site links examined across the question pages; nothing was checked');
  process.exit(1);
}
if (problems.length) {
  console.error(`[validate:question-links] FAIL: ${problems.length} link(s) on the question pages do not resolve:`);
  for (const x of problems.slice(0, 20)) console.error(`  - ${x}`);
  console.error('  Repair: npm run seo:normalize-question-routes, then commit public/questions.');
  process.exit(1);
}
console.log(`[validate:question-links] OK: ${checked} same-site link(s) across ${pages.length} question page(s) all resolve`);
