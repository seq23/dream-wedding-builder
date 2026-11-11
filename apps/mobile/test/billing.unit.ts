import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DisabledPurchases, acceptedKey } from '../src/billing/provider';
import { purchases } from '../src/billing/current';
import { addEvent, emptyLedger, entitlementsFor, moveEvent, recordVerifiedPurchase, renameEvent } from '../src/billing/events';
import { PRODUCTS } from '../src/billing/offers';

test('absent stores cannot simulate purchases or restore; production entry remains closed', async () => {
  for (const provider of [new DisabledPurchases(), purchases]) {
    assert.equal(provider.available, false);
    assert.deepEqual(await provider.products(), []);
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
test('paid names lock and only three real date moves are free', () => {
  let event = recordVerifiedPurchase(initial(), 'first', 'dw_full_plan').events[0];
  assert.throws(() => renameEvent(event, 'New wedding'), /EVENT_NAME_LOCKED/);
  assert.equal(moveEvent(event, event.date), event);
  assert.throws(() => moveEvent(event, '2027-02-30'), /INVALID_DATE/);
  for (const date of ['2027-06-13', '2027-06-14', '2027-06-15']) event = moveEvent(event, date);
  assert.equal(event.dateChanges, 3);
  assert.throws(() => moveEvent(event, '2027-06-16'), /NEW_EVENT_REQUIRED/);
  assert.equal(moveEvent(event, event.date), event);
});
test('a fresh plan cannot reuse the first unlock and new-event purchases unlock one event only', () => {
  let ledger = recordVerifiedPurchase(initial(), 'first', 'dw_full_plan');
  ledger = addEvent(ledger, 'second', 'Another wedding', '2028-06-12');
  assert.deepEqual(entitlementsFor(ledger, 'second'), []);
  assert.throws(() => recordVerifiedPurchase(ledger, 'second', 'dw_full_plan'), /NEW_EVENT_REQUIRED/);
  assert.throws(() => recordVerifiedPurchase(ledger, 'second', 'dw_planner_printables'), /NEW_EVENT_REQUIRED/);
  ledger = recordVerifiedPurchase(ledger, 'second', 'dw_new_event');
  assert.equal(ledger.events.filter(e => e.fullPlan).length, 2);
  assert.throws(() => recordVerifiedPurchase(ledger, 'second', 'dw_new_event'), /EVENT_ALREADY_PAID/);
  ledger = addEvent(ledger, 'third', 'Fresh plan after deletion', '2029-06-12');
  assert.deepEqual(entitlementsFor(ledger, 'third'), []);
  assert.throws(() => recordVerifiedPurchase(initial(), 'first', 'dw_new_event'), /FIRST_EVENT_REQUIRED/);
});
