import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DisabledPurchases, acceptedKey, choosePurchases, storeProduct, type PurchasesProvider } from '../src/billing/provider';
import { addEvent, emptyLedger, entitlementsFor, moveEvent, recordVerifiedPurchase, renameEvent } from '../src/billing/events';
import { PRODUCTS } from '../src/billing/offers';

test('the store opens only for a store build with the platform key; every other build stays closed', async () => {
  const opened: string[] = [];
  const store = { available: true } as PurchasesProvider;
  const open = (key: string) => { opened.push(key); return store; };
  assert.equal(choosePurchases('ios', { ios: 'appl_example' }, false, open), store);
  assert.equal(choosePurchases('android', { android: 'goog_example' }, false, open), store);
  assert.deepEqual(opened, ['appl_example', 'goog_example']);
  const closed = [
    choosePurchases('ios', { ios: 'appl_example' }, true, open), // the free preview never sells
    choosePurchases('ios', {}, false, open),
    choosePurchases('ios', { ios: 'test_example', android: 'goog_example' }, false, open),
    choosePurchases('android', { ios: 'appl_example' }, false, open),
    choosePurchases('web', { ios: 'appl_example', android: 'goog_example' }, false, open),
  ];
  assert.equal(opened.length, 2);
  for (const provider of closed) assert.equal(provider.available, false);
  for (const provider of [new DisabledPurchases(), ...closed]) {
    assert.equal(provider.available, false);
    assert.deepEqual(await provider.products('default'), []);
    for (const id of Object.keys(PRODUCTS) as (keyof typeof PRODUCTS)[]) await assert.rejects(provider.purchase(id), /DW_STORE_NOT_SET_UP/);
    await assert.rejects(provider.restore(), /DW_STORE_NOT_SET_UP/);
  }
  assert.equal(acceptedKey('web', 'appl_example'), false);
  assert.equal(acceptedKey('android', 'appl_example'), false);
  assert.equal(acceptedKey('ios', 'test_example'), false);
  assert.equal(acceptedKey('ios'), false);
  assert.equal(acceptedKey('ios', 'appl_example'), true);
});
const initial = () => addEvent(emptyLedger(), 'first', 'Our wedding', '2027-06-12');
test('store catalog rejects subscriptions and invalid products and preserves localized store prices', () => {
  const product = { identifier: 'dw_full_plan', subscriptionPeriod: null, priceString: '19,99 €', price: 19.99 };
  assert.deepEqual(storeProduct(product), { id: 'dw_full_plan', price: '19,99 €' });
  for (const identifier of ['toString', '__proto__', 'unknown']) assert.equal(storeProduct({ ...product, identifier }), null);
  assert.equal(storeProduct({ ...product, subscriptionPeriod: 'P1M' }), null);
  for (const price of [0, -1, NaN, Infinity]) assert.equal(storeProduct({ ...product, price }), null);
  assert.equal(storeProduct({ ...product, priceString: ' ' }), null);
});
test('each product has its exact grants and extra content stays separate from the event', () => {
  for (const id of ['dw_full_plan', 'dw_planner_printables', 'dw_day_of_kit'] as const) {
    const paid = recordVerifiedPurchase(initial(), 'first', id);
    assert.deepEqual(entitlementsFor(paid, 'first').sort(), [...PRODUCTS[id].grants].sort());
    assert.equal(entitlementsFor(paid, 'another').includes('full_plan'), false);
  }
  const paid = recordVerifiedPurchase(initial(), 'first', 'dw_full_plan');
  const topup = recordVerifiedPurchase(paid, 'first', 'dw_printables_topup');
  assert.deepEqual(entitlementsFor(topup, 'first').sort(), ['full_plan', 'printables']);
  assert.throws(() => recordVerifiedPurchase(initial(), 'first', 'dw_printables_topup'), /FULL_PLAN_REQUIRED/);
});
test('findings 2 and 14: a paid event renames and moves its date freely, never needing a new event', () => {
  let event = recordVerifiedPurchase(initial(), 'first', 'dw_full_plan').events[0];
  assert.equal(renameEvent(event, '  Sam and Alex  ').name, 'Sam and Alex');
  assert.throws(() => renameEvent(event, ' '), /INVALID_EVENT/);
  assert.equal(moveEvent(event, event.date), event);
  assert.throws(() => moveEvent(event, '2027-02-30'), /INVALID_DATE/);
  for (const date of ['2027-06-13', '2027-06-14', '2027-06-15', '2027-06-16', '2028-01-08']) event = moveEvent(event, date);
  assert.equal(event.date, '2028-01-08');
  assert.equal(event.fullPlan, true);
});
test('a fresh plan cannot reuse the first unlock and new-event purchases unlock one event only', () => {
  let ledger = recordVerifiedPurchase(initial(), 'first', 'dw_full_plan');
  ledger = addEvent(ledger, 'second', 'Another wedding', '2028-06-12');
  assert.deepEqual(entitlementsFor(ledger, 'second'), []);
  assert.throws(() => recordVerifiedPurchase(ledger, 'second', 'dw_full_plan'), /NEW_EVENT_REQUIRED/);
  assert.throws(() => recordVerifiedPurchase(ledger, 'second', 'dw_planner_printables'), /NEW_EVENT_REQUIRED/);
  const grant = 'a'.repeat(64);
  assert.throws(() => recordVerifiedPurchase(ledger, 'second', 'dw_new_event'), /NEW_EVENT_NOT_CONFIRMED/);
  assert.throws(() => recordVerifiedPurchase(ledger, 'second', 'dw_new_event', 'not-a-token'), /NEW_EVENT_NOT_CONFIRMED/);
  ledger = recordVerifiedPurchase(ledger, 'second', 'dw_new_event', grant);
  assert.equal(ledger.events.filter(e => e.fullPlan).length, 2);
  assert.throws(() => recordVerifiedPurchase(ledger, 'second', 'dw_new_event', 'b'.repeat(64)), /EVENT_ALREADY_PAID/);
  ledger = addEvent(ledger, 'third', 'Fresh plan after deletion', '2029-06-12');
  assert.deepEqual(entitlementsFor(ledger, 'third'), []);
  // The purchase that paid for the second event can never pay for a third.
  assert.throws(() => recordVerifiedPurchase(ledger, 'third', 'dw_new_event', grant), /NEW_EVENT_ALREADY_USED/);
  assert.deepEqual(entitlementsFor(ledger, 'third'), []);
  assert.throws(() => recordVerifiedPurchase(initial(), 'first', 'dw_new_event', grant), /FIRST_EVENT_REQUIRED/);
});
