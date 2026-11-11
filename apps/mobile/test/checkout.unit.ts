import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkout, checkoutRead } from '../src/billing/checkout';
import { DisabledPurchases, type PurchasesProvider } from '../src/billing/provider';
import { ACTIVE_EVENT_KEY, EVENT_LEDGER_KEY, eventStore } from '../src/billing/eventStore';
import { addEvent, recordVerifiedPurchase, entitlementsFor } from '../src/billing/events';
function setup() {
  const data = new Map<string, string>(), calls: string[] = [];
  const storage = { async getItem(k: string) { return data.get(k) ?? null; }, async setItem(k: string, v: string) { data.set(k, v); } };
  const provider: PurchasesProvider = { available: true, async products() { return []; },
    async purchase(id) { calls.push(id); return { userId: 'identity', active: [] }; },
    async restore() { calls.push('restore'); return { userId: 'identity', active: [] }; } };
  const downloads = { async refresh(id: string) { calls.push(id); return { list: { windows: [], tasks: [] }, packs: [] }; } };
  return { data, calls, storage, provider, downloads };
}
test('checkout verifies before binding; Restore preserves all recorded events; refusal and late SDK results never unlock', async () => {
  await assert.rejects(checkoutRead(() => new Promise(() => {}), 10), /too long/);
  const s = setup(), flow = checkout(s.storage, s.provider, s.downloads, () => 'first');
  assert.equal(await flow.purchase('Our event', '2027-06-12'), 'first');
  assert.deepEqual(s.calls, ['dw_full_plan', 'identity']);
  const paid = await eventStore(s.storage).read();
  assert.deepEqual(entitlementsFor(paid, 'first'), ['full_plan']);
  let history = recordVerifiedPurchase(addEvent(paid, 'second', 'Second', '2028-06-12'), 'second', 'dw_new_event');
  history = recordVerifiedPurchase(addEvent(history, 'third', 'Third', '2029-06-12'), 'third', 'dw_new_event');
  s.data.set(EVENT_LEDGER_KEY, JSON.stringify(history)); s.data.delete(ACTIVE_EVENT_KEY);
  assert.equal(await flow.restore('Replacement', '2030-06-12'), 'first');
  assert.deepEqual(await eventStore(s.storage).read(), history);
  assert.equal((await eventStore(s.storage).active())?.name, 'Our event');
  await assert.rejects(flow.purchase('Another', '2031-06-12'), /new event needs its own purchase/);
  assert.equal(s.calls.filter(c => c === 'dw_full_plan').length, 1);
  for (const restore of [false, true]) {
    const fresh = setup();
    fresh.provider.purchase = fresh.provider.restore = async () => ({ userId: 'forged', active: ['full_plan', 'printables', 'day_of_kit'] });
    const refused = checkout(fresh.storage, fresh.provider, { async refresh() { throw Error('verification refused'); } }, () => 'fresh');
    await assert.rejects(restore ? refused.restore('Event', '2027-06-12') : refused.purchase('Event', '2027-06-12'), /verification refused/);
    assert.equal(fresh.data.size, 0);
  }
  const restored = setup();
  await checkout(restored.storage, restored.provider, restored.downloads, () => 'restored').restore('Restored event', '2027-06-12');
  assert.deepEqual(restored.calls, ['restore', 'identity']);
  assert.equal((await eventStore(restored.storage).active())?.fullPlan, true);
  const invalid = setup();
  await assert.rejects(checkout(invalid.storage, invalid.provider, invalid.downloads, () => 'invalid').purchase('', '2027-06-12'), /INVALID_EVENT/);
  assert.deepEqual(invalid.calls, []);
  const disabled = setup(), off = checkout(disabled.storage, new DisabledPurchases(), disabled.downloads, () => 'off');
  await assert.rejects(off.purchase('Event', '2027-06-12'), /DW_STORE_NOT_SET_UP/);
  await assert.rejects(off.restore('Event', '2027-06-12'), /DW_STORE_NOT_SET_UP/);
  assert.deepEqual(disabled.calls, []);
  const slow = setup(); let release!: () => void;
  slow.provider.purchase = async () => { await new Promise<void>(r => { release = r; }); return { userId: 'late', active: ['full_plan'] }; };
  const timed = checkout(slow.storage, slow.provider, slow.downloads, () => 'late', 20);
  const pending = timed.purchase('Event', '2027-06-12');
  await assert.rejects(timed.purchase('Event', '2027-06-12'), /already running/);
  await assert.rejects(pending, /too long/);
  release(); await new Promise(r => setTimeout(r, 0));
  assert.equal(slow.data.size, 0); assert.deepEqual(slow.calls, []);
});
