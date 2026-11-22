import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain JavaScript module
import { catalog } from '../scripts/store/play-products.mjs';
// @ts-ignore plain JavaScript module
import { plan, run, money, productStop } from '../scripts/store/play-engine.mjs';
import { catalog as revenuecat } from '../scripts/revenuecat/setup';
import { PRODUCTS, OFFER_NAME, type ProductId } from '../src/billing/offers';

type P = { id: string; title: string; description: string; priceUsd: number | null };
type Live = { productId: string; listings: { title: string }[]; purchaseOptions: { purchaseOptionId: string; state: string; regionalPricingAndAvailabilityConfigs: { regionCode: string; price: unknown }[] }[] };
const products: P[] = catalog.products;
const livePlay = (p: P, state = 'ACTIVE', usd = p.priceUsd!): Live => ({ productId: p.id, listings: [{ title: p.title }],
  purchaseOptions: [{ purchaseOptionId: 'buy', state, regionalPricingAndAvailabilityConfigs: [{ regionCode: 'US', price: money(usd) }] }] });

test('Play gets every product RevenueCat sells, at the approved price in the code, with a valid listing', () => {
  assert.deepEqual(products.map(p => p.id), revenuecat.products.map(p => p.id));
  assert.equal(products.length, 5);
  for (const p of products) {
    assert.equal(p.priceUsd, PRODUCTS[p.id as ProductId].priceUsd, p.id);
    assert.equal(p.title, OFFER_NAME[p.id as ProductId], p.id);
    assert.equal(productStop(p), null, p.id);
  }
});

test('the plan creates only what is missing, never reprices, and leaves products the code does not know alone', () => {
  assert.equal(plan(catalog, []).create.length, products.length);
  const clean = plan(catalog, products.map(p => livePlay(p)));
  assert.equal(clean.create.length + clean.activate.length + clean.mismatches.length, 0);
  const [a, b, c, ...rest] = products;
  const mixed = plan(catalog, [livePlay(a, 'ACTIVE', 1.99), livePlay(b, 'INACTIVE'), livePlay(c, 'ACTIVE', 1.99), ...rest.map(p => livePlay(p)), livePlay({ ...a, id: 'old_thing' })]);
  assert.deepEqual(mixed.mismatches.length, 2);
  assert.deepEqual(mixed.activate.map((p: P) => p.id), [b.id]);
  assert.deepEqual(mixed.create, []);
  assert.deepEqual(mixed.extra, ['old_thing']);
  const noPrice = plan({ ...catalog, products: [{ ...a, priceUsd: null }, b] }, []);
  assert.match(noPrice.stops[0], /NAMED STOP \[PRICE_MISSING\]/);
  assert.deepEqual(noPrice.create.map((p: P) => p.id), [b.id]);
});

// A Play that answers like the real API, keeping what it is sent.
function fakePlay(opts: { deny?: string; existing?: Live[] } = {}) {
  const store = new Map<string, Live>((opts.existing ?? []).map(p => [p.productId, p]));
  const calls: string[] = [];
  const fetchFn = async (url: string, init: { method: string; body?: string }) => {
    const path = url.split('/applications/')[1].split('?')[0];
    calls.push(`${init.method} ${path}`);
    const reply = (status: number, body: unknown) => ({ ok: status < 300, status, text: async () => JSON.stringify(body) });
    if (opts.deny && path.includes(opts.deny)) return reply(403, { error: { code: 403, message: 'The caller does not have permission' } });
    if (init.method === 'GET') return store.size ? reply(200, { oneTimeProducts: [...store.values()] }) : { ok: true, status: 204, text: async () => '' };
    if (path.endsWith('pricing:convertRegionPrices')) return reply(200, { regionVersion: { version: '2025/03' },
      convertedRegionPrices: { US: { regionCode: 'US', price: money(9.99) }, GB: { regionCode: 'GB', price: money(8.99, 'GBP') } },
      convertedOtherRegionsPrice: { usdPrice: money(9.99), eurPrice: money(9.49, 'EUR') } });
    if (init.method === 'PATCH') {
      const body = JSON.parse(init.body!);
      store.set(body.productId, { ...body, purchaseOptions: body.purchaseOptions.map((o: object) => ({ ...o, state: 'DRAFT' })) });
      return reply(200, body);
    }
    if (path.endsWith('purchaseOptions:batchUpdateStates')) {
      const req = JSON.parse(init.body!).requests[0].activatePurchaseOptionRequest;
      store.get(req.productId)!.purchaseOptions[0].state = 'ACTIVE';
      return reply(200, {});
    }
    return reply(404, {});
  };
  return { store, calls, fetchFn };
}
const quiet = () => { const lines: string[] = []; return { lines, log: (l: string) => lines.push(l) }; };

test('--apply creates and activates every product at the code price, and a second run plans nothing', async () => {
  const play = fakePlay();
  const out = quiet();
  assert.equal(await run(catalog, { argv: ['--apply'], getToken: async () => 't', fetchFn: play.fetchFn, log: out.log }), 0);
  for (const p of products) {
    const s = play.store.get(p.id)!;
    assert.equal(s.purchaseOptions[0].state, 'ACTIVE');
    assert.deepEqual(s.purchaseOptions[0].regionalPricingAndAvailabilityConfigs.find(r => r.regionCode === 'US')!.price, money(p.priceUsd!));
  }
  assert.ok(out.lines.at(-1)!.includes(`read-back ${products.length}/${products.length} active, 0 mismatches`));
  const again = quiet();
  assert.equal(await run(catalog, { argv: [], getToken: async () => 't', fetchFn: play.fetchFn, log: again.log }), 0);
  assert.ok(again.lines.at(-1)!.includes(`0 to create, 0 to activate, ${products.length} already active`));
  assert.ok(!play.calls.some(c => /DELETE|batchDelete/.test(c)));
});

test('a refused key is a failure with Google\'s answer, stops at once and is never reported as created', async () => {
  const play = fakePlay({ deny: 'pricing:convertRegionPrices' });
  const out = quiet();
  assert.equal(await run(catalog, { argv: ['--apply'], getToken: async () => 't', fetchFn: play.fetchFn, log: out.log }), 1);
  assert.equal(play.calls.filter(c => c.includes('convertRegionPrices')).length, 1);
  assert.ok(out.lines.some(l => l.includes('FAILED PLAY_API_403') && l.includes('The caller does not have permission')));
  assert.match(out.lines.at(-1)!, /NAMED STOP \[PLAY_PERMISSION_DENIED\].*created 0/);
  assert.equal(play.store.size, 0);
  const listDenied = fakePlay({ deny: 'oneTimeProducts' });
  assert.equal(await run(catalog, { argv: ['--apply'], getToken: async () => 't', fetchFn: listDenied.fetchFn, log: quiet().log }), 1);
  assert.equal(await run(catalog, { argv: [], getToken: async () => '', fetchFn: listDenied.fetchFn, log: quiet().log }), 2);
});

test('an existing product at another price is left exactly as it is, and nothing is ever deleted', async () => {
  const [first] = products;
  const play = fakePlay({ existing: [livePlay(first, 'ACTIVE', 1.99)] });
  const out = quiet();
  assert.equal(await run(catalog, { argv: ['--apply'], getToken: async () => 't', fetchFn: play.fetchFn, log: out.log }), 1);
  assert.ok(!play.calls.includes(`PATCH com.weddingchecklistpdf.dreamwedding/onetimeproducts/${first.id}`));
  assert.deepEqual(play.store.get(first.id)!.purchaseOptions[0].regionalPricingAndAvailabilityConfigs[0].price, money(1.99));
  assert.ok(out.lines.some(l => l.startsWith(`MISMATCH ${first.id}`)));
});

test('no products in the code is a failure, never a clean pass', async () => {
  assert.equal(await run({ ...catalog, products: [] }, { argv: [], getToken: async () => 't', fetchFn: fakePlay().fetchFn, log: quiet().log }), 1);
});
