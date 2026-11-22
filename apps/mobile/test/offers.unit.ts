// The paywall never charges twice for something already owned (docs/APP_PLAN.md, task 8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OFFER_DETAIL, OFFER_TAG, PRICE_PROMISE, PRODUCTS, buyButtonLabel, buyLabel, initialChoice, offersFor, type Entitlement } from '../src/billing/offers';

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

test('while the payment sheet is open the chosen offer shows busy, never "Choose one above"', () => {
  const base = { available: true, preview: false, name: 'Full plan', price: '$14.99', storeName: 'App Store' } as const;
  assert.equal(buyButtonLabel({ ...base, selected: 'dw_full_plan', buying: false }), 'Get Full plan · $14.99 ›');
  assert.equal(buyButtonLabel({ ...base, selected: 'dw_full_plan', buying: true }), 'Opening the App Store…');
  assert.equal(buyButtonLabel({ ...base, selected: 'dw_new_event', buying: true }), 'Starting your new event…');
  // A chosen offer whose price has not loaded still names the offer.
  assert.equal(buyButtonLabel({ ...base, selected: 'dw_full_plan', price: undefined, buying: false }), 'Get Full plan ›');
  for (const buying of [true, false]) for (const price of ['$14.99', undefined])
    assert.notEqual(buyButtonLabel({ ...base, selected: 'dw_planner_printables', price, buying }), 'Choose one above');
  assert.equal(buyButtonLabel({ ...base, selected: undefined, buying: false }), 'Choose one above');
  assert.equal(buyButtonLabel({ ...base, available: false, preview: true, selected: 'dw_full_plan', buying: false }), 'Buying is off in this preview');
});

test('the bundle nudge claims no saving, sits only on the bundle, and chooses nothing for her', () => {
  assert.deepEqual([...PRODUCTS.dw_planner_printables.grants].sort(), ['day_of_kit', 'full_plan', 'printables']);
  assert.deepEqual(Object.keys(OFFER_TAG), ['dw_planner_printables']);
  assert.equal(initialChoice(offersFor([])), undefined);
  // Bought in steps (offersFor: full plan, then the top-up) the same things cost about the bundle's price,
  // so no text on the buy screen may claim the bundle saves money.
  for (const text of [...Object.values(OFFER_DETAIL), ...Object.values(OFFER_TAG), PRICE_PROMISE]) assert.doesNotMatch(text!, /\bsave|less than|cheaper|best value/i);
});

test('the price line names no figure: prices come from the store', () => {
  assert.doesNotMatch(PRICE_PROMISE, /\$|\d/);
});
