import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkout, checkoutRead, checkoutCatalog } from '../src/billing/checkout';
import { DisabledPurchases, type PurchasesProvider } from '../src/billing/provider';
import { ACTIVE_EVENT_KEY, EVENT_LEDGER_KEY, eventStore } from '../src/billing/eventStore';
import { addEvent, recordVerifiedPurchase, entitlementsFor, offerEntitlementsFor } from '../src/billing/events';
function setup() {
  const data = new Map<string, string>(), calls: string[] = [];
  const storage = { async getItem(k: string) { return data.get(k) ?? null; }, async setItem(k: string, v: string) { data.set(k, v); } };
  const provider: PurchasesProvider = { available: true, async products() { return []; },
    async purchase(id) { calls.push(id); return { userId: 'identity', active: [] }; },
    async restore() { calls.push('restore'); return { userId: 'identity', active: [] }; } };
  const downloads = { async refresh(id: string) { calls.push(id); return { list: { windows: [], tasks: [] }, packs: [] }; } };
  return { data, calls, storage, provider, downloads };
}
test('rejected and stalled catalogs end without blocking verified Restore', async () => {
  for (const stalled of [false, true]) {
    const s = setup();
    let finish!: (value: []) => void;
    s.provider.products = async () => {
      if (stalled) return new Promise<[]>(resolve => { finish = resolve; });
      throw Error('store unavailable');
    };
    const catalog = await checkoutCatalog(s.provider, 'default', 5);
    assert.deepEqual(catalog.products, []);
    assert.ok(catalog.error);
    await checkout(s.storage, s.provider, s.downloads, () => 'restored').restore('Our event', '2027-06-12');
    assert.equal((await eventStore(s.storage).active())?.fullPlan, true);
    assert.deepEqual(s.calls, ['restore', 'identity']);
    if (stalled) finish([]);
    assert.deepEqual(catalog.products, []);
  }
  const s = setup();
  s.provider.products = async () => [{ id: 'dw_full_plan', price: '$1.00' }];
  assert.equal((await checkoutCatalog(s.provider, 'default')).products[0].id, 'dw_full_plan');
});
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
  s.downloads.refresh = async id => {
    await eventStore(s.storage).moveDate('2027-06-13');
    return { list: { windows: [], tasks: [] }, packs: [] };
  };
  await flow.restore('Ignored', '2030-06-12');
  assert.equal((await eventStore(s.storage).active())?.date, '2027-06-13');
  assert.equal((await eventStore(s.storage).active())?.dateChanges, 1);
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

test('bundle and owner extras grant only verified files; incomplete extras keep the full plan and Restore recovers grants', async () => {
  const s = setup();
  const record = (id: 'printables' | 'day-of-kit') => ({ id, byteLength: 22, sha256: 'a'.repeat(64) });
  const archives = { printables: record('printables'), 'day-of-kit': record('day-of-kit') };
  const delivered = { async refresh() { return { list: { windows: [], tasks: [] }, packs: [], archives }; } };
  const flow = checkout(s.storage, s.provider, delivered, () => 'bundle');
  await flow.purchase('Our wedding', '2027-06-12', 'dw_planner_printables');
  assert.deepEqual(s.calls, ['dw_planner_printables']);
  assert.deepEqual(entitlementsFor(await eventStore(s.storage).read(), 'bundle'), ['printables', 'day_of_kit', 'full_plan']);
  const before = s.data.get(EVENT_LEDGER_KEY);
  await assert.rejects(flow.purchase('Ignored', '2027-06-12', 'dw_printables_topup'), /already included/);
  assert.deepEqual(JSON.parse(s.data.get(EVENT_LEDGER_KEY)!), JSON.parse(before!));
  s.data.delete(ACTIVE_EVENT_KEY);
  await flow.restore('Ignored', '2030-06-12');
  assert.deepEqual(JSON.parse(s.data.get(EVENT_LEDGER_KEY)!), JSON.parse(before!));
  assert.equal(await s.storage.getItem(ACTIVE_EVENT_KEY), 'bundle');

  for (const product of ['dw_printables_topup', 'dw_day_of_kit'] as const) {
    const owner = setup();
    const basic = checkout(owner.storage, owner.provider, owner.downloads, () => 'first');
    await assert.rejects(basic.purchase('Free', '2027-06-12', product), /Restore your full plan/);
    assert.deepEqual(owner.calls, []);
    await basic.purchase('Our event', '2027-06-12');
    let history = await eventStore(owner.storage).read();
    history = recordVerifiedPurchase(addEvent(history, 'second', 'Second', '2028-06-12'), 'second', 'dw_new_event');
    owner.data.set(EVENT_LEDGER_KEY, JSON.stringify(history));
    owner.data.set(ACTIVE_EVENT_KEY, 'second');
    owner.provider.purchase = async id => { owner.calls.push(id); return { userId: 'identity', active: ['full_plan', 'printables', 'day_of_kit'] }; };
    await basic.purchase('Ignored', '2028-06-12', product);
    assert.deepEqual(await eventStore(owner.storage).read(), history);
    const extra = product === 'dw_printables_topup' ? { printables: record('printables') } : { 'day-of-kit': record('day-of-kit') };
    const extras = checkout(owner.storage, owner.provider, { async refresh() { return { list: { windows: [], tasks: [] }, packs: [], archives: extra }; } }, () => assert.fail('extras must not create an event'));
    await extras.purchase('Ignored', '2028-06-12', product);
    const updated = await eventStore(owner.storage).read();
    assert.deepEqual(updated.events, history.events);
    assert.equal(updated.firstEventId, 'first');
    assert.equal(await owner.storage.getItem(ACTIVE_EVENT_KEY), 'second');
    assert.deepEqual(updated.extras, [product === 'dw_printables_topup' ? 'printables' : 'day_of_kit']);
    await assert.rejects(extras.purchase('Another', '2029-06-12', 'dw_new_event'), /not available/);
  }
  const refused = setup();
  refused.provider.purchase = async () => ({ userId: 'forged', active: ['full_plan', 'printables', 'day_of_kit'] });
  await checkout(refused.storage, refused.provider, refused.downloads, () => 'refused').purchase('Our event', '2027-06-12', 'dw_planner_printables');
  assert.deepEqual(entitlementsFor(await eventStore(refused.storage).read(), 'refused'), ['full_plan']);
});


test('verified but undelivered extras suppress repeat sales across restart and Restore recovers access', async () => {
  const s = setup();
  let delivered = false;
  const downloads = { async refresh() { return { list: { windows: [], tasks: [] }, packs: [], purchasedExtras: ['printables', 'day_of_kit'] as ('printables' | 'day_of_kit')[], ...(delivered ? { archives: { printables: { id: 'printables' as const, byteLength: 22, sha256: 'a'.repeat(64) }, 'day-of-kit': { id: 'day-of-kit' as const, byteLength: 22, sha256: 'b'.repeat(64) } } } : {}) }; } };
  await checkout(s.storage, s.provider, downloads, () => 'bundle').purchase('Our event', '2027-06-12', 'dw_planner_printables');
  const ledger = await eventStore(s.storage).read();
  assert.deepEqual(entitlementsFor(ledger, 'bundle'), ['full_plan']);
  const { offersFor } = await import('../src/billing/offers');
  assert.deepEqual(offersFor(offerEntitlementsFor(ledger, 'bundle')), []);
  const restarted = checkout(s.storage, s.provider, downloads, () => assert.fail('no new event'));
  for (const product of ['dw_printables_topup', 'dw_day_of_kit'] as const) await assert.rejects(restarted.purchase('Ignored', '2027-06-12', product), /already included/);
  assert.deepEqual(s.calls, ['dw_planner_printables']);
  delivered = true;
  await restarted.restore('Ignored', '2027-06-12');
  assert.deepEqual(entitlementsFor(await eventStore(s.storage).read(), 'bundle'), ['printables', 'day_of_kit', 'full_plan']);
});
