import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, toggleDone } from '@core/plan-progress';
import { addOwnTask, editOwnTask, ownTaskKey, progressStore, taskRows } from '../src/planTasks';
import { TRADITION_PREVIEWS, addTraditionPack, parseTraditionPack, removeTraditionPack, type TraditionCustomTask } from '../src/traditionPacks';

const pack = { id: 'catholic', tasks: ['one', 'two', 'three', 'four'].map(id => ({ id, windowId: '9-months', text: `Fixture ${id}`, source: 'https://example.org/ceremony' })) };
test('all seven free examples have sources and real windows; delivered files reject empty, invalid and duplicate tasks', () => {
  assert.equal(TRADITION_PREVIEWS.length, 7);
  for (const p of TRADITION_PREVIEWS) assert.ok(parseTraditionPack({ id: p.id, tasks: [p.example] }));
  assert.ok(parseTraditionPack(pack));
  for (const bad of [null, { ...pack, id: 'unknown' }, { ...pack, tasks: [] }, { ...pack, tasks: [pack.tasks[0], pack.tasks[0]] }, ...[{ windowId: 'missing' }, { source: '' }, { source: 'javascript:alert(1)' }, { text: '' }, { text: 'x'.repeat(141) }].map(change => ({ ...pack, tasks: [{ ...pack.tasks[0], ...change }] }))]) assert.equal(parseTraditionPack(bad), null);
});
test('paid packs merge once, survive restart, and removal preserves ticked, edited and unrelated tasks', async () => {
  let raw: string | null = null;
  const storage = { getItem: async () => raw, setItem: async (_key: string, value: string) => { raw = value; } };
  const store = progressStore(storage);
  const free = emptyProgress();
  assert.equal(addTraditionPack(free, pack, false), free);
  await store.update(p => addTraditionPack(p, pack, true));
  await store.update(p => addTraditionPack(p, pack, true));
  assert.equal((await store.read()).custom.length, 4);
  const key = 'tradition:catholic:one';
  await store.update(p => toggleDone(p, ownTaskKey(key), '2026-11-10T09:00:00Z'));
  await store.update(p => editOwnTask(p, 'tradition:catholic:two', '9-months', 'Our version'));
  await store.update(p => editOwnTask(p, 'tradition:catholic:three', '12-plus', 'Fixture three'));
  await store.update(p => addOwnTask(p, '9-months', 'Fixture four', 'personal'));
  const reopened = await progressStore(storage).read();
  assert.equal((reopened.custom[1] as TraditionCustomTask).tradition?.packId, 'catholic');
  const removed = await store.update(p => removeTraditionPack(p, 'catholic'));
  assert.deepEqual(removed.custom.map(t => t.id), [key, 'tradition:catholic:two', 'tradition:catholic:three', 'personal']);
  assert.equal(taskRows(removed).find(t => t.ownId === key)?.doneAt, '2026-11-10T09:00:00Z');
  const addedAgain = addTraditionPack(removed, pack, true);
  assert.equal(addedAgain.custom.length, 5);
  assert.equal(addedAgain.custom.find(t => t.id === 'tradition:catholic:two')?.text, 'Our version');
  assert.equal(addedAgain.done[ownTaskKey(key)], '2026-11-10T09:00:00Z');
});

test('free example source links avoid competing wedding planners', () => {
  assert.ok(TRADITION_PREVIEWS.length > 0);
  const competitors = ['theknot.com', 'zola.com', 'weddingwire.com'];
  for (const pack of TRADITION_PREVIEWS) {
    const host = new URL(pack.example.source).hostname;
    assert.ok(!competitors.some(domain => host === domain || host.endsWith(`.${domain}`)), pack.id);
  }
});

test('free picker adds only its example, persists once, and removal undo preserves other changes', async () => {
  const { addTraditionExample, hasTraditionPack, restoreTraditionTasks } = await import('../src/traditionPacks');
  let raw: string | null = null;
  const storage = { getItem: async () => raw, setItem: async (_key: string, value: string) => { raw = value; } };
  const store = progressStore(storage);
  assert.equal(addTraditionExample(emptyProgress(), 'unknown').custom.length, 0);
  for (const preview of TRADITION_PREVIEWS) {
    await store.update(p => addTraditionExample(addTraditionExample(p, preview.id), preview.id));
    const reopened = await progressStore(storage).read();
    assert.ok(hasTraditionPack(reopened, preview.id));
    assert.deepEqual(reopened.custom.filter((t: TraditionCustomTask) => t.tradition?.packId === preview.id).map(t => t.text), [preview.example.text]);
  }
  const before = await store.read();
  const after = await store.update(p => removeTraditionPack(p, 'catholic'));
  assert.equal(hasTraditionPack(after, 'catholic'), false);
  const removed = before.custom.filter(t => !after.custom.some(k => k.id === t.id));
  await store.update(p => addOwnTask(p, '9-months', 'My new task', 'new'));
  const undone = await store.update(p => restoreTraditionTasks(p, removed));
  assert.equal(undone.custom.length, TRADITION_PREVIEWS.length + 1);
  assert.ok(hasTraditionPack(undone, 'catholic'));
  assert.equal(restoreTraditionTasks(undone, removed).custom.length, undone.custom.length);
});
