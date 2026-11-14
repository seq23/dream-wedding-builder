import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../scripts/revenuecat/setup';
// @ts-ignore plain JavaScript module
import { diff } from '../scripts/revenuecat/engine.mjs';
import { PRODUCTS, offersFor } from '../src/billing/offers';

const ids = catalog.products.map(p => p.id);
const live = () => ({
  apps: [{ id: 'a1', type: 'app_store', app_store: { bundle_id: catalog.bundleId } }, { id: 'a2', type: 'play_store', play_store: { package_name: catalog.bundleId } }, { id: 'a3', type: 'test_store' }],
  products: ['a1', 'a2', 'a3'].flatMap(app_id => ids.map(store_identifier => ({ app_id, store_identifier }))),
  entitlementProducts: Object.fromEntries(catalog.entitlements.map(e => [e.key, e.products])),
  offeringPackages: Object.fromEntries(catalog.offerings.map(o => [o.key, o.packages.map((key, i) => ({ key, position: i + 1, products: [key] }))])),
  currentOffering: ['default'],
});

test('the RevenueCat catalog matches what the app sells and what each product unlocks', () => {
  assert.deepEqual([...ids].sort(), Object.keys(PRODUCTS).sort());
  for (const [id, p] of Object.entries(PRODUCTS)) for (const g of p.grants) assert.ok((catalog.entitlements.find(e => e.key === g)!.products as string[]).includes(id), `${g} lacks ${id}`);
  assert.deepEqual(catalog.offerings.find(o => o.key === 'default')!.packages, offersFor([]));
  assert.deepEqual(catalog.offerings.find(o => o.key === 'after_unlock')!.packages, offersFor(['full_plan']));
  assert.deepEqual(catalog.offerings.find(o => o.key === 'new_event')!.packages, offersFor([], true));
  assert.ok(!catalog.bundleId.endsWith('.placeholder'));
});

test('the read-back check passes only when RevenueCat matches the code', () => {
  assert.deepEqual(diff(catalog, live()), []);
  const wrong = live();
  wrong.entitlementProducts.printables = ['dw_printables_topup'];
  wrong.offeringPackages.after_unlock = [];
  wrong.currentOffering = ['after_unlock'];
  assert.equal(diff(catalog, wrong).length, 4);
});
