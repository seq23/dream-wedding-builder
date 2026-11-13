import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventNameStore, EVENT_NAME_KEY, NEW_EVENT_NAME_KEY } from '../src/billing/eventName';
import { ACTIVE_EVENT_KEY, EVENT_LEDGER_KEY, eventStore } from '../src/billing/eventStore';
import { addEvent, emptyLedger, recordVerifiedPurchase } from '../src/billing/events';
import { deleteLocalPlan } from '../src/deletePlan';
import { offersFor } from '../src/billing/offers';

test('checkout names persist without unlocking, paid names lock, and a new-event draft preserves the paid event', async () => {
  const data = new Map<string, string>();
  const storage = {
    async getItem(key: string) { return data.get(key) ?? null; },
    async setItem(key: string, value: string) { data.set(key, value); },
    async removeMany(keys: string[]) { for (const key of keys) data.delete(key); },
  };
  assert.deepEqual(await eventNameStore(storage).read(), { name: '', locked: false });
  await eventNameStore(storage).save('  Our wedding  ');
  assert.deepEqual(await eventNameStore(storage).read(), { name: 'Our wedding', locked: false });
  assert.equal(await eventStore(storage).active(), null);
  assert.equal(data.has(EVENT_LEDGER_KEY), false);
  for (const invalid of [' ', 'x'.repeat(141)]) await assert.rejects(eventNameStore(storage).save(invalid));
  assert.equal((await eventNameStore(storage).read()).name, 'Our wedding');
  const paid = recordVerifiedPurchase(addEvent(emptyLedger(), 'first', 'Our wedding', '2028-06-12'), 'first', 'dw_full_plan');
  data.set(EVENT_LEDGER_KEY, JSON.stringify(paid)); data.set(ACTIVE_EVENT_KEY, 'first');
  assert.deepEqual(await eventNameStore(storage).read(), { name: 'Our wedding', locked: true });
  await assert.rejects(eventNameStore(storage).save('Replacement'), /EVENT_NAME_LOCKED/);
  await eventNameStore(storage, true).save('Next wedding');
  assert.deepEqual(await eventNameStore(storage, true).read(), { name: 'Next wedding', locked: false });
  assert.deepEqual(await eventStore(storage).read(), paid);
  assert.equal((await eventStore(storage).active())?.id, 'first');
  // A second event is a consumable even for owners of the printables bundle.
  assert.deepEqual(offersFor(['full_plan', 'printables', 'day_of_kit'], true), ['dw_new_event']);
  assert.deepEqual(offersFor([], false), ['dw_planner_printables', 'dw_full_plan']);
  await deleteLocalPlan(storage, async () => {}, async () => {});
  assert.equal(data.has(EVENT_NAME_KEY), false); assert.equal(data.has(NEW_EVENT_NAME_KEY), false);
  assert.deepEqual(await eventStore(storage).read(), paid);
});
