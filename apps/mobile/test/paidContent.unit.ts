import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { repositoryLeaks } from '../scripts/content/repository';
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
    // Never a full hash of the first four words: that could be guessed back into paid wording.
    assert.match(entry.prefix, /^[a-f0-9]{8}$/);
    assert.match(entry.digest, /^[a-f0-9]{64}$/);
    assert.ok(Number.isInteger(entry.length) && entry.length >= 4);
  }
  const root = resolve(__dirname, '../../..');
  const { files, found } = repositoryLeaks(root, manifest.entries);
  assert.deepEqual(found, [], 'Private content found in repository files (text withheld)');
  console.info(`Paid-content check: ${files.length} files; ${manifest.entries.length} private fingerprints. Printables/day-of ZIP text: NOT RUN — private files not supplied.`);
});

test('repository scan rejects copied content outside mobile, including app, data, public and docs', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'dw-leak-'));
  const text = 'Fictional apricot satellites decorate silver tables at dawn.';
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    assert.throws(() => repositoryLeaks(root, [fingerprint(text)]), /No repository files/);
    const paths = ['app/page.tsx', 'data/pack.json', 'public/packet.txt', 'docs/guide.md'];
    for (const file of paths) {
      mkdirSync(resolve(root, file, '..'), { recursive: true });
      writeFileSync(resolve(root, file), text);
    }
    execFileSync('git', ['add', '.'], { cwd: root });
    assert.deepEqual(repositoryLeaks(root, [fingerprint(text)]).found.sort(), paths.sort());
    for (const file of paths) writeFileSync(resolve(root, file), 'Only freely available example content.');
    assert.deepEqual(repositoryLeaks(root, [fingerprint(text)]).found, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
