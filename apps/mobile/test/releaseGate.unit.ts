import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { stops } from '../scripts/release-gate.mjs';
const config = { bundleId: 'com.weddingchecklistpdf.dreamwedding', privacyUrl: 'https://weddingchecklistpdf.com/privacy', termsUrl: 'https://weddingchecklistpdf.com/terms' };
const receipt = { bossOsRowId: 'dw-phone-app', recordedAt: '2026-11-11' };
test('store gate rejects each unsafe setting independently and permits a clean configuration', () => {
  assert.deepEqual(stops(config, {}, receipt), []);
  assert.deepEqual(stops(config, { EXPO_PUBLIC_DW_PREVIEW: '1' }, receipt), ['PREVIEW_BUILD']);
  assert.deepEqual(stops({ ...config, bundleId: config.bundleId + '.placeholder' }, {}, receipt), ['BUNDLE_ID_PLACEHOLDER']);
  for (const field of ['privacyUrl', 'termsUrl']) {
    assert.deepEqual(stops({ ...config, [field]: '' }, {}, receipt), ['LEGAL_LINKS_MISSING']);
    assert.deepEqual(stops({ ...config, [field]: 'http://example.com' }, {}, receipt), ['LEGAL_LINKS_MISSING']);
  }
  assert.deepEqual(stops(config, {}, null), ['SCORECARD_NOT_REGISTERED']);
  for (const missing of [{ ...receipt, bossOsRowId: null }, { ...receipt, recordedAt: null }, { ...receipt, bossOsRowId: '' }]) assert.deepEqual(stops(config, {}, missing), ['SCORECARD_NOT_REGISTERED']);
  // The recorded Boss OS row (seq23/boss-os#386) clears the stop for the real file.
  const recorded = JSON.parse(readFileSync(new URL('../release/scorecard.json', import.meta.url), 'utf8'));
  assert.equal(recorded.bossOsRowId, recorded.id);
  assert.deepEqual(stops(config, {}, recorded), []);
});
test('EAS hook permits previews but blocks the current production configuration before install', () => {
  const run = (profile: string) => spawnSync(process.execPath, ['scripts/release-gate.mjs', '--if-production'], { cwd: new URL('..', import.meta.url), env: { ...process.env, EAS_BUILD_PROFILE: profile }, encoding: 'utf8' });
  assert.equal(run('preview').status, 0);
  const production = run('production');
  assert.equal(production.status, 2);
  assert.doesNotMatch(production.stdout + production.stderr, /SCORECARD_NOT_REGISTERED/);
  assert.match(production.stdout + production.stderr, /BUNDLE_ID_PLACEHOLDER/);
});
