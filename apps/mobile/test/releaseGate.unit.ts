import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
});
test('EAS hook permits previews but blocks the current production configuration before install', () => {
  const run = (profile: string) => spawnSync(process.execPath, ['scripts/release-gate.mjs', '--if-production'], { cwd: new URL('..', import.meta.url), env: { ...process.env, EAS_BUILD_PROFILE: profile }, encoding: 'utf8' });
  assert.equal(run('preview').status, 0);
  assert.equal(run('production').status, 2);
});
