// Run from apps/mobile: npx tsx scripts/content/refresh.ts <private-folder>
// Writes hashes only. Never print or copy the source content into this repo.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PLAN_WINDOWS } from '../../../../lib/dated-plan';
import { FULL_PLAN_TEASER } from '../../../../lib/full-plan-teaser';
import { TRADITION_PREVIEWS } from '../../src/traditionPacks';
import { fingerprint, words } from './leaks';
const folder = process.argv[2];
if (!folder) throw Error('PRIVATE_CONTENT_SOURCE_MISSING: supply the private source folder');
const publicText = new Set([
  ...PLAN_WINDOWS.flatMap(w => w.tasks),
  ...Object.values(FULL_PLAN_TEASER).flatMap(rows => rows.map(r => r.text)),
  ...TRADITION_PREVIEWS.map(p => p.example.text),
].map(t => words(t).join(' ')));
const sources = ['full-plan-tasks.json', ...TRADITION_PREVIEWS.map(p => `tradition-packs/${p.id}.json`)];
const entries = new Map();
for (const file of sources) {
  const source = JSON.parse(readFileSync(resolve(folder, file), 'utf8'));
  if (!Array.isArray(source.tasks) || !source.tasks.length) throw Error(`PRIVATE_CONTENT_EMPTY: ${file}`);
  let count = 0;
  for (const task of source.tasks) {
    if (typeof task.text !== 'string' || !task.text.trim()) throw Error(`PRIVATE_CONTENT_INVALID: ${file}`);
    if (publicText.has(words(task.text).join(' '))) continue;
    const entry = fingerprint(task.text);
    entries.set(entry.digest, entry);
    count++;
  }
  if (!count) throw Error(`PRIVATE_CONTENT_EMPTY: ${file}`);
}
writeFileSync(resolve(__dirname, 'fingerprints.json'), JSON.stringify({ version: 1, sources, entries: [...entries.values()] }, null, 2) + '\n');
console.info(`Fingerprinted ${entries.size} private tasks across ${sources.length} sources. Printables/day-of ZIP text: NOT RUN — private files not supplied.`);
