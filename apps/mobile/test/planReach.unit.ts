import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planReach, metricsBuild, INSTALLATION_KEY, REACHED_KEY } from '../src/planReach';
import { planContentKeys } from '../src/deletePlan';

test('plan reach excludes non-production builds, deduplicates restart, and retries failures with the same opaque identity', async () => {
  const config = { flag: '1', development: false, platform: 'ios' };
  assert.equal(metricsBuild(config), true);
  for (const other of [{ flag: undefined }, { preview: '1' }, { development: true }, { platform: 'web' }]) {
    assert.equal(metricsBuild({ ...config, ...other }), false);
  }
  const values = new Map<string, string>();
  let reads = 0;
  const storage = { async getItem(k: string) { reads++; return values.get(k) ?? null; }, async setItem(k: string, v: string) { values.set(k, v); } };
  let calls = 0;
  let succeed = false;
  const transport: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(url, 'https://weddingchecklistpdf.com/api/app-plan-reach');
    assert.equal(new Headers(init?.headers).get('x-dw-installation'), 'a'.repeat(32));
    assert.equal(init?.body, undefined);
    if (!succeed) throw Error('offline');
    return new Response(null, { status: 204 });
  };
  await planReach(storage, () => 'a'.repeat(32), transport, false).record();
  assert.equal(reads, 0); assert.equal(calls, 0);
  const first = planReach(storage, () => 'a'.repeat(32), transport, true);
  await Promise.all([first.record(), first.record()]);
  assert.equal(calls, 1); assert.equal(values.get(REACHED_KEY), undefined);
  succeed = true;
  await first.record();
  assert.equal(calls, 2); assert.equal(values.get(REACHED_KEY), '1');
  for (const k of planContentKeys) values.delete(k);
  assert.equal(values.get(INSTALLATION_KEY), 'a'.repeat(32));
  await planReach(storage, () => { throw Error('must keep identity'); }, transport, true).record();
  assert.equal(calls, 2);
});

test('stalled measurement settles by its deadline and does not falsely acknowledge reach', async () => {
  const values = new Map<string, string>();
  const storage = { async getItem(k: string) { return values.get(k) ?? null; }, async setItem(k: string, v: string) { values.set(k, v); } };
  let signal: AbortSignal | undefined;
  const transport: typeof fetch = async (_url, init) => {
    signal = init?.signal ?? undefined;
    return new Promise(() => {});
  };
  await planReach(storage, () => 'a'.repeat(32), transport, true, 10).record();
  assert.equal(signal?.aborted, true);
  assert.equal(values.get(REACHED_KEY), undefined);
});
