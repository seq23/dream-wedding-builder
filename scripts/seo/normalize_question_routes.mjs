#!/usr/bin/env node
// Rewrites engine-written links that point at the repository path instead of the
// served route.
//
// Why: the shared engine derives a related-questions link from the file's
// repository-relative path (seq23/search-loop src/site-index.mjs routeFor:
// `'/' + rel.replace(/\.html$/, '')`), so a page at public/questions/<slug>.html
// is linked as /public/questions/<slug>. In Next.js `public/` IS the web root, so
// the served route is /questions/<slug> - exactly what search-loop.config.json
// already declares as output.url_prefix - and every one of those links answers
// 404. A crawl of weddingchecklistpdf.com on 3 November 2026 found ten of them,
// which is the site's whole "Related questions" navigation: links that pass no
// authority and strand the reader.
//
// Runs in .github/scripts/search_loop_commit.sh, so tomorrow's engine page is
// corrected before it is committed, and is guarded by
// scripts/validators/validate_question_links.mjs.
import { readQuestionRetirements } from '../../lib/question-retirements.mjs';
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] || '.';
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'search-loop.config.json'), 'utf8'));
const outDir = cfg?.output?.dir;
const prefix = cfg?.output?.url_prefix;

if (!outDir || !prefix) {
  console.error('[normalize:question-routes] FAIL: search-loop.config.json must declare output.dir and output.url_prefix');
  process.exit(1);
}
// `public/` is the web root, so the served route drops it. Anything else would be
// a guess about how the host serves the directory.
const servedFrom = outDir.replace(/^public\//, '');
if (`/${servedFrom}/` !== prefix) {
  console.error(`[normalize:question-routes] FAIL: output.dir "${outDir}" is served at "/${servedFrom}/" but output.url_prefix says "${prefix}"; one of the two is wrong`);
  process.exit(1);
}

const dir = path.join(root, outDir);
const pages = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.html')).sort() : [];
if (pages.length === 0) {
  try {
    const inventory = readQuestionRetirements(root);
    console.log(`[normalize_question_routes] OK: ${inventory.count} retired questions resolve directly to ${inventory.targets.length} kept main-site destinations; publisher entity complete`);
  } catch (error) {
    console.error(`[normalize_question_routes] FAIL: ${error.message}`);
    process.exit(1);
  }
  process.exit(0);
}

// href="/public/questions/..." and href="https://host/public/questions/..."
const WRONG = new RegExp(`(href=["'](?:https?://[^"'/]+)?)/${outDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`, 'g');

let rewritten = 0;
let links = 0;
for (const file of pages) {
  const p = path.join(dir, file);
  const before = fs.readFileSync(p, 'utf8');
  let n = 0;
  const after = before.replace(WRONG, (_m, head) => { n += 1; return `${head}${prefix}`; });
  if (n === 0) continue;
  fs.writeFileSync(p, after);
  rewritten += 1;
  links += n;
}

console.log(`[normalize:question-routes] OK: ${pages.length} page(s) read, ${links} link(s) on ${rewritten} page(s) moved from /${outDir}/ to ${prefix}`);
