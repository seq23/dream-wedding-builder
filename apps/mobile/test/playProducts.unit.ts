// The Google Play catalog the shared tool (~/bin/play-products) reads. The tool itself (plan, apply,
// outages, offers) is tested in seq-bin (tests/store/play-products.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain JavaScript module
import { catalog, launchOffer } from '../scripts/store/play-products.mjs';
import { catalog as revenuecat } from '../scripts/revenuecat/setup';
import { LAUNCH_OFFER } from '../src/billing/offers';

type Offer = { id: string; priceUsd: number; startTime: string | null; endTime: string | null };
type P = { id: string; title: string; description: string; priceUsd: number | null; offers?: Offer[] };
const products: P[] = catalog.products;

// The approved store prices (6 Nov 2026), written out by hand so a change in the code fails here first.
const APPROVED: Record<string, number> = {
  dw_full_plan: 14.99, dw_planner_printables: 34.99, dw_printables_topup: 19.99, dw_day_of_kit: 9.99, dw_new_event: 14.99,
};

test('Play gets every product RevenueCat sells, at the approved price, with a listing Play accepts', () => {
  assert.equal(catalog.packageName, revenuecat.bundleId);
  assert.deepEqual(products.map(p => p.id), revenuecat.products.map(p => p.id));
  assert.deepEqual(Object.fromEntries(products.map(p => [p.id, p.priceUsd])), APPROVED);
  for (const p of products) {
    assert.ok(p.title.length > 0 && p.title.length <= 55, p.id);
    assert.ok(p.description.length > 0 && p.description.length <= 200, p.id);
    assert.doesNotMatch(`${p.title} ${p.description}`, /\$\d/, `${p.id}: no price in the text, Play shows it in the buyer's currency`);
  }
});

test('the $9.99 launch price is a 30-day Play offer on the full plan, never a changed list price', () => {
  const withOffers = products.filter(p => p.offers?.length);
  assert.deepEqual(withOffers.map(p => p.id), ['dw_full_plan']);
  const [o] = withOffers[0].offers!;
  assert.equal(o.id, 'launch');
  assert.equal(o.priceUsd, 9.99);
  assert.ok(o.priceUsd < APPROVED.dw_full_plan);
  assert.equal(LAUNCH_OFFER.days, 30);
  // Not launched yet: no dates, so the tool reports it WAITING and creates nothing.
  assert.equal(o.startTime, LAUNCH_OFFER.startTime ? new Date(LAUNCH_OFFER.startTime).toISOString() : null);
  const dated = launchOffer({ ...LAUNCH_OFFER, startTime: '2027-02-01' });
  assert.equal(dated.startTime, '2027-02-01T00:00:00.000Z');
  assert.equal(dated.endTime, '2027-03-03T00:00:00.000Z');
});
