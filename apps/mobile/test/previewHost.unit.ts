import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { moveBundledAssets } from '../scripts/preview/host.mjs';

// Cloudflare Pages drops any folder named node_modules, which blanked the preview (10 Nov 2026).
test('bundled fonts leave assets/node_modules and the bundle points at their new place', () => {
  const dist = mkdtempSync(join(tmpdir(), 'dw-preview-'));
  mkdirSync(join(dist, 'assets/node_modules/@expo-google-fonts/x'), { recursive: true });
  mkdirSync(join(dist, '_expo/static/js/web'), { recursive: true });
  writeFileSync(join(dist, 'assets/node_modules/@expo-google-fonts/x/Font.abc.ttf'), 'font');
  writeFileSync(join(dist, '_expo/static/js/web/entry.js'), 'load("/assets/node_modules/@expo-google-fonts/x/Font.abc.ttf")');
  writeFileSync(join(dist, 'index.html'), '<html></html>');
  assert.equal(moveBundledAssets(dist), 1);
  assert.equal(existsSync(join(dist, 'assets/node_modules')), false);
  assert.equal(readFileSync(join(dist, 'assets/nm/@expo-google-fonts/x/Font.abc.ttf'), 'utf8'), 'font');
  const bundle = readFileSync(join(dist, '_expo/static/js/web/entry.js'), 'utf8');
  assert.equal(bundle.includes('/assets/node_modules/'), false);
  assert.ok(bundle.includes('/assets/nm/@expo-google-fonts/x/Font.abc.ttf'));
});
