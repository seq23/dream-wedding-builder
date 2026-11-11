import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteLocalPlan, planContentKeys } from '../src/deletePlan';
import { dateStore } from '../src/weddingDate';
import { progressStore, taskCount } from '../src/planTasks';
import { addCustomTask, emptyProgress, toggleDone } from '../../../lib/plan-progress';

test('delete clears content and reminders, preserves purchases, and refuses silent cancellation failure', async () => {
  const data = new Map(planContentKeys.map(key => [key, 'old content']));
  data.set('dw.billing.events.v1', 'paid event history');
  data.set('unrelated', 'keep');
  const storage = {
    async getItem(key: string) { return data.get(key) ?? null; },
    async setItem(key: string, value: string) { data.set(key, value); },
    async removeMany(keys: string[]) { keys.forEach(key => data.delete(key)); },
  };
  await dateStore(storage).save('2028-06-12', '2026-11-11');
  const progress = progressStore(storage);
  const pendingSave = progress.update(() => toggleDone(addCustomTask(emptyProgress(), '9-months', 'Our own task', 'own-1'), 'own::own-1', '2026-11-11T09:00:00Z'));
  await pendingSave;
  assert.equal(taskCount(await progress.read()).done, 1);
  assert.equal((await progress.read()).custom.length, 1);
  let scheduled = ['dw-wedding-day'];
  await assert.rejects(deleteLocalPlan(storage, async () => { throw Error('OS failure'); }, async () => {}));
  assert.equal(data.get('dw.wedding-date.v1'), '2028-06-12');
  await deleteLocalPlan(storage, async () => { scheduled = []; }, () => progress.update(() => emptyProgress()));
  assert.deepEqual(scheduled, []);
  for (const key of planContentKeys) assert.equal(data.has(key), false);
  assert.equal(await dateStore(storage).read(), null);
  assert.equal(taskCount(await progressStore(storage).read()).done, 0);
  assert.equal((await progressStore(storage).read()).custom.length, 0);
  assert.equal(data.get('dw.billing.events.v1'), 'paid event history');
  assert.equal(data.get('unrelated'), 'keep');
});
