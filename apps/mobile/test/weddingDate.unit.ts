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
  await assert.rejects(dateStore(storage).save('2027-02-29', '2026-11-10'), { message: buildDatedPlan('2027-02-29', '2026-11-10').headline });
  assert.equal(await dateStore(storage).read(), '');
  // Finding 2: a past date is refused until she says "Yes, that's right", then it saves.
  await assert.rejects(dateStore(storage).save('2026-01-01', '2026-11-10'), /PAST_DATE/);
  assert.equal(await dateStore(storage).read(), '');
  await dateStore(storage).save('2026-01-01', '2026-11-10', true);
  assert.equal(await dateStore(storage).read(), '2026-01-01');
});
