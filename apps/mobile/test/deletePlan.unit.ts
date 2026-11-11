import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteLocalPlan, planContentKeys } from '../src/deletePlan';
import { dateStore } from '../src/weddingDate';
import { buildDatedPlan, lockedPlanRows, progressStore, taskCount } from '../src/planTasks';
import { addCustomTask, emptyProgress, toggleDone } from '../../../lib/plan-progress';

test('delete clears content and reminders, preserves purchases, and refuses silent cancellation failure', async () => {
  const data = new Map(planContentKeys.map(key => [key, 'old content']));
  // Seed these independently so an omitted deletion key fails this regression.
  const privateKeys = ['dw.planning-details.v1', 'dw.ai-signups.v1', 'dw.ai-marketing.v1'];
  for (const key of privateKeys) data.set(key, 'private details');
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
  for (const key of [...planContentKeys, ...privateKeys]) assert.equal(data.has(key), false);
  assert.equal(await dateStore(storage).read(), null);
  assert.equal(taskCount(await progressStore(storage).read()).done, 0);
  assert.equal((await progressStore(storage).read()).custom.length, 0);
  assert.equal(data.get('dw.billing.events.v1'), 'paid event history');
  assert.equal(data.get('unrelated'), 'keep');
});


test('date edits from settings are read afresh by the plan without losing tasks or ticks', async () => {
  const data = new Map<string, string>();
  const storage = {
    async getItem(key: string) { return data.get(key) ?? null; },
    async setItem(key: string, value: string) { data.set(key, value); },
  };
  const dates = dateStore(storage);
  const progress = progressStore(storage);
  const saved = await progress.update(() => toggleDone(
    addCustomTask(emptyProgress(), '9-months', 'Our own task', 'own-1'),
    'own::own-1', '2026-11-11T09:00:00Z',
  ));
  // Same reads and shared date projection used when the plan regains focus.
  async function openPlan() {
    const [date, tasks] = await Promise.all([dates.read(), progress.read()]);
    return { plan: buildDatedPlan(date ?? '', '2026-11-11'), locked: lockedPlanRows(date ?? '', '9-months'), tasks };
  }
  await dates.save('2028-06-12', '2026-11-11');
  const before = await openPlan();
  await dates.save('2028-07-12', '2026-11-11');
  const after = await openPlan();
  assert.notDeepEqual(after.plan.windows, before.plan.windows);
  assert.ok(before.locked.length > 0);
  assert.notEqual(after.locked[0].dueOn, before.locked[0].dueOn);
  assert.deepEqual(after.tasks, saved);
  await dates.save('', '2026-11-11');
  const undated = await openPlan();
  assert.equal(undated.plan.state, 'none');
  assert.deepEqual(undated.locked, []);
  assert.deepEqual(undated.tasks, saved);
});
