import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress } from '@core/plan-progress';
import { dateStore } from '../src/weddingDate';
import { progressStore, taskCount } from '../src/planTasks';
import { loadSamplePlan } from '../src/previewPlan';

test('preview sample persists through a restart with two ticks and one own task', async () => {
  const values = new Map<string, string>();
  const storage = { getItem: async (key: string) => values.get(key) ?? null, setItem: async (key: string, value: string) => { values.set(key, value); } };
  await loadSamplePlan(true, dateStore(storage), progressStore(storage));
  assert.equal(await dateStore(storage).read(), '2027-06-12');
  const saved = await progressStore(storage).read();
  assert.equal(saved.custom.length, 1);
  assert.deepEqual(taskCount(saved), { done: 2, total: taskCount(emptyProgress()).total + 1 });
});
test('without the preview flag no sample data can be written', async () => {
  let writes = 0;
  await assert.rejects(loadSamplePlan(false, { save: async () => { writes++; } }, { update: async () => { writes++; return emptyProgress(); } }), /PREVIEW_DISABLED/);
  assert.equal(writes, 0);
});
