import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { stops } from '../scripts/release-gate.mjs';
import { acceptedKey } from '../src/billing/provider';
const config = { bundleId: 'com.weddingchecklistpdf.dreamwedding', privacyUrl: 'https://weddingchecklistpdf.com/privacy', termsUrl: 'https://weddingchecklistpdf.com/terms' };
const receipt = { bossOsRowId: 'dw-phone-app', recordedAt: '2026-11-11' };
// Test-only stand-ins with the store prefixes; real keys live in the EAS production environment.
const keys = { EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: 'appl_test', EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: 'goog_test' };
test('store gate rejects each unsafe setting independently and permits a clean configuration', () => {
  assert.deepEqual(stops(config, keys, receipt), []);
  assert.deepEqual(stops(config, { ...keys, EXPO_PUBLIC_DW_PREVIEW: '1' }, receipt), ['PREVIEW_BUILD']);
  assert.deepEqual(stops({ ...config, bundleId: config.bundleId + '.placeholder' }, keys, receipt), ['BUNDLE_ID_PLACEHOLDER']);
  for (const field of ['privacyUrl', 'termsUrl']) {
    assert.deepEqual(stops({ ...config, [field]: '' }, keys, receipt), ['LEGAL_LINKS_MISSING']);
    assert.deepEqual(stops({ ...config, [field]: 'http://example.com' }, keys, receipt), ['LEGAL_LINKS_MISSING']);
  }
  assert.deepEqual(stops(config, keys, null), ['SCORECARD_NOT_REGISTERED']);
  for (const missing of [{ ...receipt, bossOsRowId: null }, { ...receipt, recordedAt: null }, { ...receipt, bossOsRowId: '' }]) assert.deepEqual(stops(config, keys, missing), ['SCORECARD_NOT_REGISTERED']);
  // The recorded Boss OS row (seq23/boss-os#386) clears the stop for the real file.
  const recorded = JSON.parse(readFileSync(new URL('../release/scorecard.json', import.meta.url), 'utf8'));
  assert.equal(recorded.bossOsRowId, recorded.id);
  assert.deepEqual(stops(config, keys, recorded), []);
});
test('EAS hook permits previews and passes the registered production configuration (bundle ID registered with Apple 14 Nov 2026)', () => {
  const run = (profile: string, extra: Record<string, string> = keys) => spawnSync(process.execPath, ['scripts/release-gate.mjs', '--if-production'], { cwd: new URL('..', import.meta.url), env: { ...process.env, EXPO_PUBLIC_DW_PREVIEW: '', EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: '', EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: '', EAS_BUILD_PROFILE: profile, ...extra }, encoding: 'utf8' });
  assert.equal(run('preview').status, 0);
  const production = run('production');
  assert.equal(production.status, 0, production.stdout + production.stderr);
  assert.doesNotMatch(production.stdout + production.stderr, /NAMED STOP/);
  assert.match(production.stdout, /store configuration passes/);
  const shipped = JSON.parse(readFileSync(new URL('../release/config.json', import.meta.url), 'utf8'));
  assert.equal(shipped.bundleId, 'com.weddingchecklistpdf.dreamwedding');
  assert.deepEqual(stops({ ...shipped, bundleId: shipped.bundleId + '.placeholder' }, keys, receipt), ['BUNDLE_ID_PLACEHOLDER']);
});
test('a store build refuses a missing or wrong RevenueCat key for its platform (a paywall that cannot buy)', () => {
  const android = { EAS_BUILD_PLATFORM: 'android' };
  const ios = { EAS_BUILD_PLATFORM: 'ios' };
  // Android production (the Play internal-track build): only a goog_ key passes.
  assert.deepEqual(stops(config, { ...android, EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: 'goog_test' }, receipt), []);
  for (const bad of [undefined, '', 'appl_test', 'test_abc', 'sk_secret']) {
    assert.deepEqual(stops(config, { ...android, EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: 'appl_test', EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: bad }, receipt), ['REVENUECAT_KEY_MISSING'], String(bad));
  }
  // iOS keeps its own key; an Android key never stands in for it.
  assert.deepEqual(stops(config, { ...ios, EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: 'appl_test' }, receipt), []);
  assert.deepEqual(stops(config, { ...ios, EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: 'goog_test', EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: 'goog_test' }, receipt), ['REVENUECAT_KEY_MISSING']);
  // A manual run with no platform needs both.
  assert.deepEqual(stops(config, { EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: 'appl_test' }, receipt), ['REVENUECAT_KEY_MISSING']);
  // The gate and the app agree on what a usable key is.
  for (const [os, key] of [['android', 'goog_x'], ['android', 'appl_x'], ['ios', 'appl_x'], ['ios', 'goog_x']] as const) {
    const env = { EAS_BUILD_PLATFORM: os, EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: os === 'ios' ? key : undefined, EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: os === 'android' ? key : undefined };
    assert.equal(stops(config, env, receipt).length === 0, acceptedKey(os, key), `${os} ${key}`);
  }
  // Through the real EAS hook: an Android production build with no key exits 2 with the named stop.
  const hook = (env: Record<string, string>) => spawnSync(process.execPath, ['scripts/release-gate.mjs', '--if-production'], { cwd: new URL('..', import.meta.url), env: { ...process.env, EXPO_PUBLIC_DW_PREVIEW: '', EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: '', EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: '', EAS_BUILD_PROFILE: 'production', EAS_BUILD_PLATFORM: 'android', ...env }, encoding: 'utf8' });
  const refused = hook({});
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /NAMED STOP \[REVENUECAT_KEY_MISSING\]/);
  assert.equal(hook({ EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: 'goog_test' }).status, 0);
});
