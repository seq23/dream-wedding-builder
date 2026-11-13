import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateStore } from '../src/weddingDate';
import { buildDatedPlan } from '../../../lib/dated-plan';
test('date and explicit not-set survive a fresh store instance', async () => {
  const data = new Map<string, string>();
  const storage = { async getItem(k: string) { return data.get(k) ?? null; }, async setItem(k: string, v: string) { data.set(k, v); } };
  assert.equal(await dateStore(storage).read(), null);
  await dateStore(storage).save('2028-02-29', '2026-11-10');
  assert.equal(await dateStore(storage).read(), '2028-02-29');
  await dateStore(storage).save('', '2026-11-10');
  assert.equal(await dateStore(storage).read(), '');
  assert.equal(buildDatedPlan(await dateStore(storage).read()).state, 'none');
  for (const date of ['2026-01-01', '2027-02-29']) {
    await assert.rejects(dateStore(storage).save(date, '2026-11-10'), { message: buildDatedPlan(date, '2026-11-10').headline });
    assert.equal(await dateStore(storage).read(), '');
  }
});
