// The paywall never charges twice for something already owned (docs/APP_PLAN.md, task 8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OFFER_DETAIL, PRODUCTS, buyLabel, initialChoice, offersFor, type Entitlement } from '../src/billing/offers';

test('finding 1: a couple with nothing sees the full plan first, nothing is chosen for her, and the button names her pick and price', () => {
  assert.deepEqual(offersFor([]), ['dw_full_plan', 'dw_planner_printables']);
  assert.deepEqual(offersFor(['day_of_kit']), ['dw_full_plan', 'dw_planner_printables']);
  assert.equal(initialChoice(offersFor([])), undefined);
  assert.equal(initialChoice(offersFor(['full_plan'])), undefined);
  assert.equal(initialChoice(offersFor(['full_plan'], true)), 'dw_new_event');
  assert.equal(buyLabel('Planner + printables', '$34.99'), 'Get Planner + printables · $34.99 ›');
  assert.match(OFFER_DETAIL.dw_planner_printables, /printables: files to print/);
});

test('full plan owners see the top-up, never the bundle', () => {
  assert.deepEqual(offersFor(['full_plan']), ['dw_printables_topup', 'dw_day_of_kit']);
  assert.deepEqual(offersFor(['full_plan', 'day_of_kit']), ['dw_printables_topup']);
});

test('printables owners see no offer at all', () => {
  for (const owned of [['printables'], ['full_plan', 'printables'], ['full_plan', 'printables', 'day_of_kit']] as Entitlement[][]) {
    assert.deepEqual(offersFor(owned), [], owned.join('+'));
  }
});

test('no offer ever sells an entitlement already owned, and the top-up route costs what the bundle does', () => {
  const all: Entitlement[] = ['full_plan', 'printables', 'day_of_kit'];
  for (let mask = 0; mask < 8; mask++) {
    const owned = all.filter((_, i) => mask & (1 << i));
    const offers = offersFor(owned);
    for (const id of offers) assert.ok(PRODUCTS[id].grants.some(g => !owned.includes(g)), `${id} offered to ${owned.join('+') || 'nobody'} adds nothing`);
    if (!owned.includes('full_plan')) assert.ok(!offers.includes('dw_printables_topup'), 'top-up only after the full plan');
  }
  const cents = (usd: number) => Math.round(usd * 100);
  const viaTopUp = cents(PRODUCTS.dw_full_plan.priceUsd) + cents(PRODUCTS.dw_printables_topup.priceUsd);
  assert.ok(Math.abs(viaTopUp - cents(PRODUCTS.dw_planner_printables.priceUsd)) <= 1, '$34.98 by the top-up vs $34.99 bundle');
});
