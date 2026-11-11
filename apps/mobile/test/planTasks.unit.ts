import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, toggleDone, taskKey } from '@core/plan-progress';
import { buildDatedPlan } from '@core/dated-plan';
import { addOwnTask, catchUpRows, editOwnTask, ownTaskKey, progressStore, removeCustomTask, taskCount, taskRows } from '../src/planTasks';

test('tick stamps and untick clears without moving rows; totals include own tasks only once', () => {
  let p = addOwnTask(emptyProgress(), '9-months', 'Our task', 'a');
  const keys = taskRows(p).map(r => r.key);
  const key = ownTaskKey('a');
  p = toggleDone(p, key, '2026-11-10T09:00:00Z');
  assert.deepEqual(taskRows(p).map(r => r.key), keys);
  assert.equal(taskRows(p).find(r => r.key === key)?.doneAt, '2026-11-10T09:00:00Z');
  assert.deepEqual(taskCount(p), { done: 1, total: 24 });
  p = toggleDone(p, key, 'later');
  assert.equal(p.done[key], undefined);
  assert.deepEqual(taskCount(p), { done: 0, total: 24 });
});
test('own tasks trim to site limit, edit in place keeping stamp, remove their tick', () => {
  let p = addOwnTask(emptyProgress(), '12-plus', 'x'.repeat(160), 'a');
  assert.equal(p.custom[0].text.length, 140);
  p = addOwnTask(p, '12-plus', 'Second task', 'b');
  p = toggleDone(p, ownTaskKey('a'), 'stamp');
  p = editOwnTask(p, 'a', '9-months', 'New words');
  assert.deepEqual(p.custom.map(t => t.id), ['a', 'b']);
  assert.equal(p.done[ownTaskKey('a')], 'stamp');
  assert.equal(Object.keys(p.done).length, 1);
  assert.equal(editOwnTask(p, 'a', 'unknown', 'x'), p);
  assert.equal(editOwnTask(p, 'a', '9-months', '  '), p);
  p = removeCustomTask(p, 'a');
  assert.deepEqual(p.custom.map(t => t.id), ['b']);
  assert.equal(Object.keys(p.done).length, 0);
});
test('catch-up includes own tasks from closed windows and excludes completed ones', () => {
  let p = addOwnTask(emptyProgress(), '12-plus', 'Call our families', 'a');
  const plan = buildDatedPlan('2027-06-12', '2026-11-06');
  assert.equal(catchUpRows(p, plan).length, 5);
  p = toggleDone(p, ownTaskKey('a'), 'stamp');
  assert.equal(catchUpRows(p, plan).length, 4);
  assert.equal(catchUpRows(p, buildDatedPlan('')).length, 0);
});
test('serialized phone writes survive restart; failed writes reject without breaking the next write', async () => {
  const values = new Map<string, string>();
  let fails = false;
  const storage = { getItem: async (key: string) => values.get(key) ?? null, setItem: async (key: string, value: string) => { if (fails) throw Error('full'); values.set(key, value); } };
  const store = progressStore(storage);
  await Promise.all([store.update(p => addOwnTask(p, '9-months', 'One', 'a')), store.update(p => addOwnTask(p, '9-months', 'Two', 'b'))]);
  assert.equal((await progressStore(storage).read()).custom.length, 2);
  fails = true;
  await assert.rejects(store.update(p => removeCustomTask(p, 'a')));
  fails = false;
  assert.equal((await store.update(p => removeCustomTask(p, 'a'))).custom.length, 1);
});

test('identical custom and built-in task text keep independent completion through edit and removal', async () => {
  const { PLAN_WINDOWS } = await import('@core/dated-plan');
  const window = PLAN_WINDOWS[0]; const text = window.tasks[0];
  const builtIn = taskKey(window.id, text);
  let p = toggleDone(emptyProgress(), builtIn, 'original');
  p = addOwnTask(p, window.id, text, 'a');
  p = addOwnTask(p, window.id, text, 'b');
  assert.equal(taskRows(p).filter(row => row.doneAt).length, 1);
  p = toggleDone(p, ownTaskKey('a'), 'custom');
  p = editOwnTask(p, 'a', window.id, 'Changed task');
  assert.equal(p.done[builtIn], 'original');
  assert.equal(p.done[ownTaskKey('a')], 'custom');
  assert.equal(p.done[ownTaskKey('b')], undefined);
  p = removeCustomTask(p, 'a');
  assert.equal(p.done[builtIn], 'original');
  assert.equal(p.done[ownTaskKey('a')], undefined);
});

test('legacy ticks migrate once, so unticking a duplicate never resurrects its completion', async () => {
  const { PLAN_WINDOWS } = await import('@core/dated-plan');
  const window = PLAN_WINDOWS[0]; const text = window.tasks[0];
  const builtIn = taskKey(window.id, text);
  let raw = JSON.stringify({ done: { [builtIn]: 'legacy' }, custom: [{ id: 'a', windowId: window.id, text }] });
  const store = progressStore({ getItem: async () => raw, setItem: async (_key, value) => { raw = value; } });
  assert.equal((await store.read()).done[ownTaskKey('a')], 'legacy');
  await store.update(p => toggleDone(p, ownTaskKey('a'), 'unused'));
  const reopened = await store.read();
  assert.equal(reopened.done[ownTaskKey('a')], undefined);
  assert.equal(reopened.done[builtIn], 'legacy');
});
