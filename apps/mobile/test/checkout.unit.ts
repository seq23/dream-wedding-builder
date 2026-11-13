import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkout, checkoutRead, checkoutCatalog } from '../src/billing/checkout';
import { DisabledPurchases, type PurchasesProvider } from '../src/billing/provider';
import { ACTIVE_EVENT_KEY, EVENT_LEDGER_KEY, eventStore } from '../src/billing/eventStore';
import { addEvent, recordVerifiedPurchase, entitlementsFor, offerEntitlementsFor, unusedNewEvents } from '../src/billing/events';
import { parseLedger } from '../src/billing/eventStore';
import { newEventDate } from '../src/billing/newEvent';
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
  let history = recordVerifiedPurchase(addEvent(paid, 'second', 'Second', '2028-06-12'), 'second', 'dw_new_event', '2'.repeat(64));
  history = recordVerifiedPurchase(addEvent(history, 'third', 'Third', '2029-06-12'), 'third', 'dw_new_event', '3'.repeat(64));
  // Restore while the first event is open keeps every event and stays on it.
  s.data.set(EVENT_LEDGER_KEY, JSON.stringify(history));
  assert.equal(await flow.restore('Replacement', '2030-06-12'), 'first');
  assert.deepEqual(await eventStore(s.storage).read(), history);
  assert.equal((await eventStore(s.storage).active())?.name, 'Our event');
  // After "Delete my plan" (no open event) Restore returns the newest event she paid for.
  s.data.delete(ACTIVE_EVENT_KEY);
  assert.equal(await flow.restore('Replacement', '2030-06-12'), 'third');
  assert.deepEqual(await eventStore(s.storage).read(), history);
  assert.equal((await eventStore(s.storage).active())?.name, 'Third');
  s.data.set(ACTIVE_EVENT_KEY, 'first');
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
  await assert.rejects(checkout(invalid.storage, invalid.provider, invalid.downloads, () => 'invalid').purchase('', '2027-06-12'), /Type a name for your event/);
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
    history = recordVerifiedPurchase(addEvent(history, 'second', 'Second', '2028-06-12'), 'second', 'dw_new_event', '2'.repeat(64));
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
    // A new-event purchase the server does not confirm starts no event.
    await assert.rejects(extras.purchase('Another', '2029-06-12', 'dw_new_event'), /could not be confirmed yet/);
    assert.deepEqual((await eventStore(owner.storage).read()).events, history.events);
    assert.equal(await owner.storage.getItem(ACTIVE_EVENT_KEY), 'second');
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

test('Restore on a new phone with no event name asks for the name in plain words and never reaches the store', async () => {
  const s = setup();
  const downloads = { async refresh() { return assert.fail('no download without a name'); } };
  await assert.rejects(checkout(s.storage, s.provider, downloads, () => 'new-phone').restore('  ', '2027-06-12'), /Type a name for your event/);
  assert.deepEqual(s.calls, []);
  assert.equal(s.data.has(EVENT_LEDGER_KEY), false);
});

test('a new event: one confirmed purchase starts one event, never two; Restore brings back paid events; deletion frees nothing', async () => {
  const T1 = '1'.repeat(64), T2 = '2'.repeat(64);
  const s = setup();
  let confirmed: string[] = [], n = 0;
  s.downloads.refresh = async (id: string) => { s.calls.push(id); return { list: { windows: [], tasks: [] }, packs: [], ...(confirmed.length ? { newEvents: confirmed } : {}) }; };
  const flow = checkout(s.storage, s.provider, s.downloads, () => `event-${++n}`);
  const bought = () => s.calls.filter(c => c === 'dw_new_event').length;
  const paidEvents = async () => (await eventStore(s.storage).read()).events.filter(e => e.fullPlan).map(e => e.name);
  // No first full plan: the store is never opened for a new event.
  await assert.rejects(flow.purchase('Second wedding', '2028-06-12', 'dw_new_event'), /first full plan/);
  assert.equal(bought(), 0);
  await flow.purchase('First wedding', '2027-06-12');
  await assert.rejects(flow.purchase(' ', '2028-06-12', 'dw_new_event'), /name for your new event/);
  assert.equal(bought(), 0);
  // The store took the purchase but the server confirms nothing: no event, the current one untouched.
  await assert.rejects(flow.purchase('Second wedding', '2028-06-12', 'dw_new_event'), /could not be confirmed yet/);
  assert.equal(bought(), 1);
  assert.deepEqual(await paidEvents(), ['First wedding']);
  assert.equal((await eventStore(s.storage).active())?.name, 'First wedding');
  // Restore then finds the confirmed purchase; starting the event does not charge again.
  confirmed = [T1];
  await flow.restore('ignored', '2027-06-12');
  assert.deepEqual(unusedNewEvents(await eventStore(s.storage).read()), [T1]);
  assert.deepEqual(await paidEvents(), ['First wedding']);
  const second = await flow.purchase('Second wedding', '2028-06-12', 'dw_new_event');
  assert.equal(bought(), 1);
  assert.deepEqual(await paidEvents(), ['First wedding', 'Second wedding']);
  const active = await eventStore(s.storage).active();
  assert.deepEqual([active?.id, active?.name, active?.date, active?.dateChanges, active?.fullPlan], [second, 'Second wedding', '2028-06-12', 0, true]);
  assert.deepEqual(unusedNewEvents(await eventStore(s.storage).read()), []);
  // Restore again (the same transaction replayed) adds no event and stays on the new one.
  for (let i = 0; i < 2; i++) await flow.restore('ignored', '2027-06-12');
  assert.deepEqual(await paidEvents(), ['First wedding', 'Second wedding']);
  assert.equal((await eventStore(s.storage).active())?.id, second);
  assert.deepEqual(unusedNewEvents(await eventStore(s.storage).read()), []);
  // A replayed confirmation after a real charge still starts nothing: only a new token does.
  await assert.rejects(flow.purchase('Third wedding', '2029-06-12', 'dw_new_event'), /could not be confirmed yet/);
  assert.equal(bought(), 2);
  assert.deepEqual(await paidEvents(), ['First wedding', 'Second wedding']);
  confirmed = [T1, T2];
  await flow.restore('ignored', '2027-06-12');
  await flow.purchase('Third wedding', '2029-06-12', 'dw_new_event');
  assert.equal(bought(), 2);
  assert.deepEqual(await paidEvents(), ['First wedding', 'Second wedding', 'Third wedding']);
  // One purchase in one step: charged once, one event.
  const direct = setup(); let m = 0;
  direct.downloads.refresh = async () => ({ list: { windows: [], tasks: [] }, packs: [], ...(direct.calls.includes('dw_new_event') ? { newEvents: [T1, T1] } : {}) });
  const once = checkout(direct.storage, direct.provider, direct.downloads, () => `d-${++m}`);
  await once.purchase('First', '2027-06-12');
  await once.purchase('Second', '2028-06-12', 'dw_new_event');
  assert.deepEqual(direct.calls, ['dw_full_plan', 'dw_new_event']);
  assert.equal((await eventStore(direct.storage).read()).events.filter(e => e.fullPlan).length, 2);
  // "Delete my plan" keeps the purchase record: the used purchase cannot start another event.
  s.data.delete(ACTIVE_EVENT_KEY);
  await assert.rejects(flow.purchase('After delete', '2030-06-12', 'dw_new_event'), /could not be confirmed yet/);
  assert.equal((await paidEvents()).length, 3);
  assert.equal(await flow.restore('ignored', '2027-06-12'), (await eventStore(s.storage).read()).events[2].id);
  // A new phone: Restore returns the first event and the two paid events to start, at no charge.
  const phone = setup(); let p = 0;
  phone.downloads.refresh = async () => ({ list: { windows: [], tasks: [] }, packs: [], newEvents: [T1, T2] });
  const fresh = checkout(phone.storage, phone.provider, phone.downloads, () => `p-${++p}`);
  await fresh.restore('First wedding', '2027-06-12');
  assert.equal(unusedNewEvents(await eventStore(phone.storage).read()).length, 2);
  await fresh.purchase('Second wedding', '2028-06-12', 'dw_new_event');
  await fresh.purchase('Third wedding', '2029-06-12', 'dw_new_event');
  assert.deepEqual(phone.calls.filter(c => c === 'dw_new_event'), []);
  assert.equal((await eventStore(phone.storage).read()).events.filter(e => e.fullPlan).length, 3);
  // A saved history in which one purchase pays for two events, or for the first event, is refused.
  const ledger = await eventStore(phone.storage).read();
  const twice = { ...ledger, events: ledger.events.map((e, i) => i === 2 ? { ...e, grant: ledger.events[1].grant } : e) };
  assert.throws(() => parseLedger(JSON.stringify(twice)), /could not be read/);
  assert.throws(() => parseLedger(JSON.stringify({ ...ledger, events: ledger.events.map((e, i) => i === 0 ? { ...e, grant: T1 } : e) })), /could not be read/);
  // Store off: the named stop, and nothing is written.
  const off = setup();
  await assert.rejects(checkout(off.storage, new DisabledPurchases(), off.downloads, () => 'off').purchase('Event', '2028-06-12', 'dw_new_event'), /DW_STORE_NOT_SET_UP/);
  assert.equal(off.data.size, 0);
  // The new event takes the date she asked for only when it is a real date that has not passed.
  assert.equal(newEventDate('2028-09-01', '2027-06-12', '2026-11-13'), '2028-09-01');
  for (const bad of ['2020-01-01', '2028-02-31', 'soon', undefined, ['2028-09-01']]) assert.equal(newEventDate(bad, '2027-06-12', '2026-11-13'), '2027-06-12');
});
