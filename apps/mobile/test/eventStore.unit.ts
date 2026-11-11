import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVE_EVENT_KEY, EVENT_LEDGER_KEY, eventStore, parseLedger } from '../src/billing/eventStore';
import { addEvent, emptyLedger, recordVerifiedPurchase } from '../src/billing/events';
import { dateStore } from '../src/weddingDate';
import { deleteLocalPlan } from '../src/deletePlan';

test('paid date policy survives restart, rapid edits, failed writes and deletion without reusing an unlock', async () => {
  let ledger = recordVerifiedPurchase(addEvent(emptyLedger(), 'first', 'Our wedding', '2028-06-12'), 'first', 'dw_full_plan');
  for (const id of ['second', 'third']) ledger = recordVerifiedPurchase(addEvent(ledger, id, 'Another event', '2029-06-12'), id, 'dw_new_event');
  const data = new Map([[EVENT_LEDGER_KEY, JSON.stringify(ledger)], [ACTIVE_EVENT_KEY, 'first']]);
  let fail = false;
  const storage = {
    async getItem(key: string) { return data.get(key) ?? null; },
    async setItem(key: string, value: string) { if (fail) throw Error('disk full'); data.set(key, value); },
    async removeMany(keys: string[]) { for (const key of keys) data.delete(key); },
  };
  const dates = dateStore(storage);
  assert.equal(await dates.read(), '2028-06-12');
  await dates.save('2028-06-12', '2026-11-11');
  assert.equal((await eventStore(storage).active())?.dateChanges, 0);
  fail = true;
  await assert.rejects(dates.save('2028-06-13', '2026-11-11'), /disk full/);
  fail = false;
  assert.equal((await eventStore(storage).active())?.dateChanges, 0);
  await Promise.all(['2028-06-13', '2028-06-14', '2028-06-15'].map(date => dates.save(date, '2026-11-11')));
  assert.equal(await dateStore(storage).read(), '2028-06-15');
  assert.equal((await eventStore(storage).active())?.dateChanges, 3);
  await assert.rejects(dateStore(storage).save('2028-06-16', '2026-11-11'), /NEW_EVENT_REQUIRED/);
  await assert.rejects(dates.save('', '2026-11-11'), /INVALID_DATE/);
  assert.equal(await dates.read(), '2028-06-15');
  assert.equal((await eventStore(storage).active())?.name, 'Our wedding');
  assert.deepEqual((await eventStore(storage).read()).events.slice(1), ledger.events.slice(1));
  await deleteLocalPlan(storage, async () => {}, async () => {});
  assert.equal(await dateStore(storage).read(), null);
  assert.equal((await eventStore(storage).read()).events.filter(e => e.fullPlan).length, 3);
  await dateStore(storage).save('2031-06-12', '2026-11-11');
  assert.equal(await eventStore(storage).active(), null);
  assert.equal(await dateStore(storage).read(), '2031-06-12');
});

test('corrupt event history and dangling active ids fail visibly without resetting allowances', async () => {
  for (const raw of ['{bad', '{}', JSON.stringify({ ...emptyLedger(), firstEventId: 'missing' }), JSON.stringify({ ...emptyLedger(), extras: ['full_plan'] })]) assert.throws(() => parseLedger(raw), /could not be read/);
  const paid = recordVerifiedPurchase(addEvent(emptyLedger(), 'one', 'Wedding', '2028-06-12'), 'one', 'dw_full_plan');
  for (const change of [{ dateChanges: -1 }, { dateChanges: 4 }, { date: '2028-02-30' }, { fullPlan: 'yes' }]) assert.throws(() => parseLedger(JSON.stringify({ ...paid, events: [{ ...paid.events[0], ...change }] })), /could not be read/);
  assert.throws(() => parseLedger(JSON.stringify({ ...paid, events: [paid.events[0], paid.events[0]] })), /could not be read/);
  const storage = { async getItem(key: string) { return key === ACTIVE_EVENT_KEY ? 'missing' : null; }, async setItem() { assert.fail('must not write'); } };
  await assert.rejects(dateStore(storage).save('2028-06-12', '2026-11-11'), /could not be found/);
});
