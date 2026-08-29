#!/usr/bin/env node
'use strict';
// No published page may contain internal build instructions.
//
// The external review agent sends recommendations as build directives shaped like
//   "FILEPATH: x || CURRENT: ... || MISSING: ... || EDIT: ..."
// In a sibling repo two generator paths rendered those as reader-facing copy: a
// fallback "acceptance checklist" card, and target.answer via
// "Citation-ready update: ". 163 published pages carried the first and 100 the
// second - the second inside the direct-answer block, which is the exact text an
// answer engine extracts.
//
// It also explains a reported symptom: the agent kept re-flagging pages marked
// released, because it was reading its own instruction back off the page instead
// of the content it asked for.
//
// Scan surface is adapted to this repo. There is no static published HTML here:
// pages are rendered by Next from app/ and components/ over content modules in
// data/*.ts, so those are what a leak would surface in. The scanned set is:
//   - app/ and components/          reader-facing JSX and route handlers
//   - public/ and out/              static and exported HTML, when present
//   - data/*.ts (top level only)    the authored content modules
// data/ subdirectories are deliberately not scanned: data/search_intelligence,
// data/release, data/ops and data/authority_scale hold the agent's own repair
// and diagnosis artifacts, which are supposed to contain this text.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const EVIDENCE = path.join(ROOT, 'artifacts/validation/internal-instruction-leak.json');
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'data', 'artifacts', 'reports', 'staging', 'templates',
  '.next', '.open-next', 'out-tsc', 'coverage', 'test-results',
]);
const SCAN_DIRS = ['app', 'components', 'public', 'out'];
const SCAN_EXTS = new Set(['.html', '.tsx', '.ts', '.mdx', '.md']);

const PATTERNS = [
  [/FILEPATH:/, 'raw agent recommendation (FILEPATH:)'],
  [/\|\|\s*(CURRENT|MISSING|EDIT)\s*:/i, 'raw agent recommendation field separator'],
  [/Citation-ready update:/i, 'instruction appended to the answer block'],
  [/Marker-only framework cards/i, 'build policy text rendered as page copy'],
  [/Required semantic acceptance:/i, 'build policy text rendered as page copy'],
];

const offenders = [];
let scanned = 0;

function inspect(abs) {
  scanned += 1;
  const text = fs.readFileSync(abs, 'utf8');
  const rel = path.relative(ROOT, abs);
  for (const [re, why] of PATTERNS) {
    if (re.test(text)) { offenders.push({ path: rel, reason: why }); return; }
  }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(abs);
      continue;
    }
    if (SCAN_EXTS.has(path.extname(entry.name))) inspect(abs);
  }
}

for (const dir of SCAN_DIRS) walk(path.join(ROOT, dir));
// Authored content modules only; the generated subtrees under data/ stay exempt.
const dataDir = path.join(ROOT, 'data');
if (fs.existsSync(dataDir)) {
  for (const entry of fs.readdirSync(dataDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.ts')) inspect(path.join(dataDir, entry.name));
  }
}

// A gate whose pass is indistinguishable from "found nothing to check" is not a
// gate. Confirmed in a sibling repo on 2026-08-29: three HARD_FAIL validators of
// this same family globbed for built HTML under a gitignored dist/, validation
// ran before the build, and they examined zero pages and exited 0 on every push.
// This repo's SCAN_DIRS are committed source (app, components, public) so the
// count has always been real - 77 files on 2026-08-29 - but the shape that made
// the sibling silently unchecked is one deleted directory away, so zero is now a
// failure rather than a pass.
if (scanned === 0) {
  console.error('VALIDATION FAIL: examined 0 files.');
  console.error(`- scan surface: ${[...SCAN_DIRS, 'data/*.ts'].join(', ')}`);
  console.error('- a pass here would mean "nothing was checked", not "nothing is wrong"');
  process.exit(1);
}

fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
fs.writeFileSync(EVIDENCE, `${JSON.stringify({
  schema_version: '1.0',
  validator: 'no-internal-instruction-leak',
  generated_at: new Date().toISOString(),
  status: offenders.length ? 'FAIL' : 'PASS',
  scan_surface: [...SCAN_DIRS, 'data/*.ts'],
  files_scanned: scanned,
  offender_count: offenders.length,
  offenders: offenders.slice(0, 200),
}, null, 2)}\n`);

if (offenders.length) {
  console.error(`VALIDATION FAIL: ${offenders.length} published source file(s) contain internal build instructions`);
  for (const o of offenders.slice(0, 15)) console.error(`- ${o.path} :: ${o.reason}`);
  if (offenders.length > 15) console.error(`- ...and ${offenders.length - 15} more`);
  console.error('- remedy: render the requested content, never the recommendation text that asked for it');
  process.exit(1);
}
console.log(`no internal instruction leak: PASS (${scanned} published-surface files)`);
