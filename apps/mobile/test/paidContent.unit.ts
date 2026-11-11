import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fingerprint, leaks } from '../scripts/content/leaks';
import manifest from '../scripts/content/fingerprints.json';

test('private content detection catches copied and wrapped text while allowing fictional fixtures', () => {
  const entries = [fingerprint('Fictional marmalade robots arrange violet chairs by moonlight.')];
  assert.equal(leaks('const text = "Fictional marmalade robots arrange\\nviolet chairs by moonlight."', entries), true);
  assert.equal(leaks('FICTIONAL marmalade robots arrange\n violet chairs by moonlight!', entries), true);
  assert.equal(leaks('Fictional marmalade robots arrange orange chairs by sunlight.', entries), false);
  assert.throws(() => leaks('anything', []), /No private content/);
});

test('tracked repository files contain no fingerprinted private task or pack text', () => {
  assert.ok(manifest.entries.length > 0, 'No private content checked');
  assert.equal(manifest.sources.length, 8, 'Expected full plan and seven tradition packs');
  for (const entry of manifest.entries) {
    assert.match(entry.prefix, /^[a-f0-9]{64}$/);
    assert.match(entry.digest, /^[a-f0-9]{64}$/);
    assert.ok(Number.isInteger(entry.length) && entry.length >= 4);
  }
  const root = resolve(__dirname, '../../..');
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
  assert.ok(files.length > 0, 'No repository files checked');
  const found: string[] = [];
  for (const file of files) {
    const bytes = readFileSync(resolve(root, file));
    if (!bytes.includes(0) && leaks(bytes.toString('utf8'), manifest.entries)) found.push(file);
  }
  assert.deepEqual(found, [], 'Private content found in repository files (text withheld)');
  console.info(`Paid-content check: ${files.length} files; ${manifest.entries.length} private fingerprints. Printables/day-of ZIP text: NOT RUN — private files not supplied.`);
});
