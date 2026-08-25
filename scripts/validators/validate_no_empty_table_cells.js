#!/usr/bin/env node
'use strict';
// No published page may ship a table with empty cells.
//
// An empty <td></td> is a generator that ran out of data mid-row and emitted the
// cell anyway. To a reader it is a blank box; to an answer engine it is a
// malformed table whose columns no longer line up with their headers, so the
// whole table becomes unusable as an extractable fact source. A sibling repo
// shipped 257 pages in this state.
//
// A cell holding &nbsp;, a dash, or "n/a" is a deliberate authored placeholder
// and passes: this only catches cells with nothing in them at all.
//
// Same adapted scan surface as the instruction-leak guard: this repo renders its
// pages from app/ and components/ rather than shipping static HTML, so a literal
// empty <td></td> is caught in the JSX that emits it. A cell whose content is a
// runtime expression ({value}) is not statically decidable and is not flagged.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const EVIDENCE = path.join(ROOT, 'artifacts/validation/empty-table-cells.json');
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'data', 'artifacts', 'reports', 'staging', 'templates',
  '.next', '.open-next', 'out-tsc', 'coverage', 'test-results',
]);
const SCAN_DIRS = ['app', 'components', 'public', 'out'];
const SCAN_EXTS = new Set(['.html', '.tsx', '.ts', '.mdx', '.md']);

// <td>, <td class="x">, <td></td> and <td>\n  </td> all count as empty.
const EMPTY_CELL = /<(td|th)\b[^>]*>\s*<\/\1>/gi;

const offenders = [];
let scanned = 0;

function inspect(abs) {
  scanned += 1;
  const text = fs.readFileSync(abs, 'utf8');
  const matches = text.match(EMPTY_CELL);
  if (matches) offenders.push({ path: path.relative(ROOT, abs), empty_cells: matches.length });
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
const dataDir = path.join(ROOT, 'data');
if (fs.existsSync(dataDir)) {
  for (const entry of fs.readdirSync(dataDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.ts')) inspect(path.join(dataDir, entry.name));
  }
}

const totalCells = offenders.reduce((sum, o) => sum + o.empty_cells, 0);
fs.mkdirSync(path.dirname(EVIDENCE), { recursive: true });
fs.writeFileSync(EVIDENCE, `${JSON.stringify({
  schema_version: '1.0',
  validator: 'no-empty-table-cells',
  generated_at: new Date().toISOString(),
  status: offenders.length ? 'FAIL' : 'PASS',
  scan_surface: [...SCAN_DIRS, 'data/*.ts'],
  files_scanned: scanned,
  offender_count: offenders.length,
  empty_cell_count: totalCells,
  offenders: offenders.slice(0, 200),
}, null, 2)}\n`);

if (offenders.length) {
  console.error(`VALIDATION FAIL: ${offenders.length} published source file(s) ship ${totalCells} empty table cell(s)`);
  for (const o of offenders.slice(0, 15)) console.error(`- ${o.path} :: ${o.empty_cells} empty cell(s)`);
  if (offenders.length > 15) console.error(`- ...and ${offenders.length - 15} more`);
  console.error('- remedy: omit the row, or fill the cell with real content');
  process.exit(1);
}
console.log(`no empty table cells: PASS (${scanned} published-surface files)`);
