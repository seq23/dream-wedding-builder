import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../scripts/revenuecat/setup';
import { PRODUCTS, offersFor } from '../src/billing/offers';

// The tool itself and its read-back are tested in seq-bin (tests/store/revenuecat-setup.test.mjs).
const ids = catalog.products.map(p => p.id);

test('the RevenueCat catalog matches what the app sells and what each product unlocks', () => {
  assert.deepEqual([...ids].sort(), Object.keys(PRODUCTS).sort());
  for (const [id, p] of Object.entries(PRODUCTS)) for (const g of p.grants) assert.ok((catalog.entitlements.find(e => e.key === g)!.products as string[]).includes(id), `${g} lacks ${id}`);
  assert.deepEqual(catalog.offerings.find(o => o.key === 'default')!.packages, offersFor([]));
  assert.deepEqual(catalog.offerings.find(o => o.key === 'after_unlock')!.packages, offersFor(['full_plan']));
  assert.deepEqual(catalog.offerings.find(o => o.key === 'new_event')!.packages, offersFor([], true));
  assert.ok(!catalog.bundleId.endsWith('.placeholder'));
});

test('only dw_new_event is consumable: on Play RevenueCat consumes a one-time purchase not held as non_consumable, and restore would give nothing back', () => {
  for (const p of catalog.products) assert.equal(p.kind, p.id === 'dw_new_event' ? 'consumable' : 'non_consumable', p.id);
});
