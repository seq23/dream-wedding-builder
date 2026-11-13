import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { paidFilesTracked, repositoryLeaks } from '../scripts/content/repository';
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

test('no paid product file is tracked: not under the old folders, not named after a product', () => {
  const { files, names, found } = paidFilesTracked(resolve(__dirname, '../../..'));
  assert.deepEqual(found, [], 'Paid product files are tracked in git; they belong in DW_PRODUCTS_DIR, never the repo');
  console.info(`Paid-file check: ${files.length} tracked files against ${names.length} product ids and SKUs.`);

  const root = mkdtempSync(resolve(tmpdir(), 'dw-paid-file-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    const put = (file: string, text = 'x') => { mkdirSync(resolve(root, file, '..'), { recursive: true }); writeFileSync(resolve(root, file), text); };
    put('README.md');
    execFileSync('git', ['add', '.'], { cwd: root });
    assert.throws(() => paidFilesTracked(root), /ENOENT/);
    put('data/products/product_catalog.json', '{"products":[]}');
    execFileSync('git', ['add', '.'], { cwd: root });
    assert.throws(() => paidFilesTracked(root), /No paid product ids/);
    put('data/products/product_catalog.json', '{"products":[{"id":"fictional-moon-kit","sku":"FIC-MOON-001"}]}');
    const paid = ['product-builds/releases/anything.txt', 'product-builds/r2/products/fictional-moon-kit/current.zip', 'public/Fictional-Moon-Kit.pdf', 'docs/FIC-MOON-001_v1.0.0.xlsx', 'apps/mobile/assets/fic-moon-001_starter.csv'];
    const free = ['public/samples/moon-sample.pdf', 'public/product-previews/fictional-moon-kit/fictional-moon-kit-preview-1.png', 'product-builds/r2/release_manifest.json', 'docs/fictional-moon-kit.md'];
    for (const file of [...paid, ...free]) put(file);
    execFileSync('git', ['add', '.'], { cwd: root });
    assert.deepEqual(paidFilesTracked(root).found.sort(), [...paid].sort());
  } finally { rmSync(root, { recursive: true, force: true }); }
});
