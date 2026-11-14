import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { appUnlock, confirmedEntitlements, confirmedNewEvents, storePurchases, APP_ASSETS, REVENUECAT_PROJECT, type UnlockEnv } from '@/lib/app-unlock';
import { createDownloadToken } from '@/lib/fulfillment';

const now = Date.parse('2026-11-11T16:00:00Z');
const bought = '2026-11-10T16:00:00Z';
const identity = '$RCAnonymousID:' + 'a'.repeat(32);
let raw: DatabaseSync;
let env: UnlockEnv;
// Real v2 replies captured 14 Nov 2026 (tests/fixtures/revenuecat). The purchase item follows
// RevenueCat's v2 Purchase object; no real store purchase exists yet to capture one.
const fixture = (name: string) => JSON.parse(readFileSync(`tests/fixtures/revenuecat/${name}.json`, 'utf8')) as { status: number; body: Record<string, unknown> };
const products = fixture('v2-products').body;
const productId = (store: string) => (products.items as { id: string; store_identifier: string; app_id: string }[]).find(p => p.store_identifier === store && p.app_id === 'app630a018765')?.id ?? 'prod_unknown';
const purchase = (product: string, extra: object = {}) => ({ object: 'purchase', id: 'purc_fictional', customer_id: identity, original_customer_id: identity,
  product_id: productId(product), purchased_at: Date.parse(bought), quantity: 1, status: 'owned', environment: 'production', store: 'app_store',
  store_purchase_identifier: 'fictional-transaction', ownership: 'purchased', ...extra });
const list = (items: unknown[]) => ({ object: 'list', items, next_page: null, url: '/v2/fictional' });
function customer(product = 'dw_full_plan', sandbox = false) { return list([purchase(product, sandbox ? { environment: 'sandbox' } : {})]); }
const owned = (value: unknown) => storePurchases(value, products);
function post(id = identity) { return new Request('https://weddingchecklistpdf.com/api/app-unlock', { method: 'POST', headers: { authorization: `Bearer ${id}`, 'cf-connecting-ip': '203.0.113.1' } }); }
const source = (value: unknown, status = 200) => vi.fn<typeof fetch>().mockImplementation(async input =>
  String(input).includes('/products?') ? Response.json(products) : Response.json(value, { status }));
const call = (req: Request, upstream = source(customer()), at = now) => appUnlock(req, env, upstream, at);
beforeEach(() => {
  raw = new DatabaseSync(':memory:');
  const statement = (sql: string, args: unknown[] = []) => ({
    async run() { return { meta: { changes: Number(raw.prepare(sql).run(...args as never[]).changes) } }; },
    async first() { return raw.prepare(sql).get(...args as never[]) as Record<string, unknown> ?? null; },
  });
  env = {
    APP_PURCHASES_ENABLED: 'true', REVENUECAT_SECRET: 'test-server-secret', DOWNLOAD_SIGNING_SECRET: 'test-delivery-secret',
    DB: { prepare(sql: string) { return { ...statement(sql), bind: (...args: unknown[]) => statement(sql, args) }; } },
    PRODUCT_RELEASES: { get: vi.fn(async () => ({ body: new Blob(['fictional paid fixture']).stream(), size: 22 })) },
  };
});
afterEach(() => { raw.close(); vi.restoreAllMocks(); });

it('counts only verified production full-plan transactions once across Restore and phones, without blocking delivery on metric failure', async () => {
  raw.exec(readFileSync('migrations/0010_app_metrics.sql', 'utf8'));
  const count = () => raw.prepare('SELECT COUNT(*) n FROM app_confirmed_unlocks').get()?.n;
  expect((await call(post())).status).toBe(200);
  expect(count()).toBe(0); // off by default
  env.APP_METRICS_ENABLED = 'true';
  for (const id of [identity, identity, '$RCAnonymousID:' + 'b'.repeat(32)]) expect((await call(post(id))).status).toBe(200);
  expect(count()).toBe(1);
  const row = raw.prepare('SELECT * FROM app_confirmed_unlocks').get()!;
  expect(row.purchased_at).toBe(Date.parse(bought));
  expect(row.transaction_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(row)).not.toContain('fictional-transaction');
  expect((await call(post(), source(customer('dw_full_plan', true)))).status).toBe(403);
  expect((await call(post(), source(customer('dw_printables_topup')))).status).toBe(200);
  expect((await call(new Request('https://preview.example/api/app-unlock', post()))).status).toBe(200);
  expect(count()).toBe(1);
  raw.exec('DROP TABLE app_confirmed_unlocks');
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  expect((await call(post())).status).toBe(200);
  expect(log).toHaveBeenCalledWith(expect.stringContaining('APP_METRICS_STORAGE_UNAVAILABLE'));
});

it('fails closed with a named stop before contacting RevenueCat when secrets or the switch are absent', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const upstream = source(customer());
  const result = await appUnlock(post(), {}, upstream, now);
  expect(result.status).toBe(503);
  expect((await result.json()).stop).toBe('REVENUECAT_SECRET_MISSING');
  env.APP_PURCHASES_ENABLED = 'false';
  expect((await (await call(post(), upstream)).json()).stop).toBe('DW_STORE_NOT_SET_UP');
  expect(upstream).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalled();
});
it('unknown, refused and client-asserted entitlements reveal no paid content and answer identically', async () => {
  const unknown = await call(post(), source({}, 404));
  const refused = await call(post(), source({ active: ['full_plan'], subscriber: { entitlements: { full_plan: true } } }));
  const forged = await call(new Request(post(), { body: JSON.stringify({ active: ['full_plan'] }) }), source({}));
  for (const r of [unknown, refused, forged]) expect(r.status).toBe(403);
  expect(await unknown.text()).toBe(await refused.text());
  expect(await forged.json()).toEqual({ error: 'Purchase could not be confirmed. Restore your purchase and try again.' });
  expect(env.PRODUCT_RELEASES!.get).not.toHaveBeenCalled();
});
it('checks only the anonymous bearer identity server-side, then streams only its signed assets', async () => {
  const upstream = source(customer());
  const response = await call(post(), upstream);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const body = await response.json();
  expect(body.active).toEqual(['full_plan']);
  expect(body.downloads.map((a: {id: string}) => a.id)).toEqual(APP_ASSETS.filter(a => a.entitlement === 'full_plan').map(a => a.id));
  const sent = expect.objectContaining({ headers: { Authorization: 'Bearer test-server-secret', Accept: 'application/json' }, signal: expect.any(AbortSignal), redirect: 'error' });
  expect(upstream).toHaveBeenCalledWith(`https://api.revenuecat.com/v2/projects/${REVENUECAT_PROJECT}/customers/${encodeURIComponent(identity)}/purchases?limit=1000`, sent);
  expect(upstream).toHaveBeenCalledWith(`https://api.revenuecat.com/v2/projects/${REVENUECAT_PROJECT}/products?limit=1000`, sent);
  expect(JSON.stringify(body)).not.toContain(identity);
  const download = await call(new Request('https://weddingchecklistpdf.com' + body.downloads[0].path), upstream);
  expect(download.status).toBe(200);
  expect(await download.text()).toBe('fictional paid fixture');
  expect(env.PRODUCT_RELEASES!.get).toHaveBeenCalledExactlyOnceWith('plans/checklist-full-plan-v1.json');
  expect(upstream).toHaveBeenCalledTimes(2);
});
it('a real confirmed printable purchase alone permits printables; full-plan buyers cannot download them', async () => {
  const paid = await (await call(post(), source(customer('dw_printables_topup')))).json();
  expect(paid.active).toEqual(['printables']);
  expect(paid.downloads).toHaveLength(1);
  expect(paid.downloads[0].id).toBe('printables');
  expect((await call(new Request('https://weddingchecklistpdf.com' + paid.downloads[0].path))).status).toBe(200);
  expect(env.PRODUCT_RELEASES!.get).toHaveBeenCalledWith('app/printables-v1.zip');
  expect(confirmedEntitlements(owned(customer('dw_planner_printables')), now)).toEqual(['full_plan', 'printables', 'day_of_kit']);
  expect(confirmedEntitlements(owned(customer('dw_full_plan')), now)).toEqual(['full_plan']);
});
it('sandbox, refunded, future-dated, malformed, promotional, Test Store and unsupported purchases grant nothing', () => {
  expect(confirmedEntitlements(owned(customer('dw_full_plan', true)), now)).toEqual([]);
  expect(confirmedEntitlements(owned(customer('unknown')), now)).toEqual([]);
  expect(confirmedEntitlements(owned(customer('dw_new_event')), now)).toEqual([]);
  for (const change of [{ status: 'refunded' }, { status: undefined }, { store: 'promotional' }, { store: 'test_store' }, { environment: undefined },
    { purchased_at: '2026-11-10' }, { purchased_at: now + 60000 }, { id: '' }, { product_id: 'prod_unknown' }]) {
    expect(confirmedEntitlements(owned(list([purchase('dw_full_plan', change)])), now)).toEqual([]);
  }
  expect(confirmedEntitlements(owned(null), now)).toEqual([]);
  expect(confirmedEntitlements(storePurchases(customer(), null), now)).toEqual([]);
});
it('the sandbox purchase of a store reviewer unlocks only while the review switch is on, and is never counted as a sale', async () => {
  const sandbox = () => source(customer('dw_full_plan', true));
  expect((await call(post(), sandbox())).status).toBe(403);
  raw.exec(readFileSync('migrations/0010_app_metrics.sql', 'utf8'));
  env.APP_SANDBOX_PURCHASES = 'true'; env.APP_METRICS_ENABLED = 'true';
  const reviewed = await call(post(), sandbox());
  expect(reviewed.status).toBe(200);
  expect((await reviewed.json()).active).toEqual(['full_plan']);
  expect(raw.prepare('SELECT COUNT(*) AS n FROM app_confirmed_unlocks').get()?.n).toBe(0);
  // Promotional grants stay refused even with the switch on.
  expect((await call(post(), source(list([purchase('dw_full_plan', { environment: 'sandbox', store: 'promotional' })])))).status).toBe(403);
});
it('expired, tampered, unsigned, cross-purpose and unknown-asset links never read R2', async () => {
  const body = await (await call(post())).json();
  const original = body.downloads[0].path;
  const requests = [
    '/api/app-unlock', original + 'tampered',
    '/api/app-unlock?token=' + createDownloadToken('dwapp:printables', now + 60000, 'test-delivery-secret'),
    '/api/app-unlock?token=' + createDownloadToken('dwapp:unknown', now + 60000, 'app-unlock-v1:test-delivery-secret'),
  ];
  for (const path of requests) expect((await call(new Request('https://weddingchecklistpdf.com' + path))).status).toBe(403);
  expect((await call(new Request('https://weddingchecklistpdf.com' + original), undefined, body.expiresAt)).status).toBe(403);
  expect(env.PRODUCT_RELEASES!.get).not.toHaveBeenCalled();
});
it('refuses predictable IDs, caps verification calls, and fails closed on upstream or storage failure', async () => {
  const upstream = source(customer());
  expect((await call(post('predictable-id'), upstream)).status).toBe(403);
  expect(upstream).not.toHaveBeenCalled();
  for (let i=0; i<20; i++) expect((await call(post(), upstream)).status).toBe(200);
  expect((await call(post(), upstream)).status).toBe(429);
  expect(upstream).toHaveBeenCalledTimes(40);
  raw.exec('DELETE FROM rate_events');
  expect((await call(post(), source({}, 500))).status).toBe(503);
  expect((await call(post(), vi.fn<typeof fetch>().mockRejectedValue(new Error('timeout')))).status).toBe(503);
  expect((await call(post(), source('malformed'))).status).toBe(403);
  expect((await call(post(), source({ ...customer(), next_page: '/v2/next' }))).status).toBe(503);
  const body = await (await call(post())).json();
  env.PRODUCT_RELEASES!.get = vi.fn(async () => null);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const missing = await call(new Request('https://weddingchecklistpdf.com' + body.downloads[0].path));
  expect(missing.status).toBe(503);
  expect((await missing.json()).stop).toBe('APP_PAID_ASSET_MISSING');
});
it('the global ceiling refuses a different connection before another upstream request', async () => {
  await call(post());
  raw.prepare('INSERT INTO rate_events(bucket,key,at) SELECT ?, ?, ? FROM json_each(?)').run('app-unlock-day', 'all', now / 1000, JSON.stringify(Array(9999).fill(0)));
  const upstream = source(customer());
  const request = post(); request.headers.set('cf-connecting-ip', '203.0.113.2');
  expect((await call(request, upstream)).status).toBe(429);
  expect(upstream).not.toHaveBeenCalled();
});

it('oversized streamed verification replies fail closed without downloading anything', async () => {
  const cancelled = vi.fn();
  const upstream = vi.fn<typeof fetch>().mockImplementation(async () => new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(512 * 1024 + 1)); },
    cancel: cancelled,
  })));
  expect((await call(post(), upstream)).status).toBe(503);
  expect(cancelled).toHaveBeenCalledTimes(2); // purchases and products are both capped
  expect(env.PRODUCT_RELEASES!.get).not.toHaveBeenCalled();
});

it('each verified new-event transaction is one extra event: replays, Restore on another phone, refunds and forgeries never add a second', async () => {
  const event = (id: string, extra: object = {}) => purchase('dw_new_event', { id, ...extra });
  const withEvents = (events: unknown[], base = customer()) => list([...base.items, ...events]);
  const events = async (value: unknown, id = identity) => {
    const result = await call(post(id), source(value));
    return { status: result.status, body: await result.json() as { newEvents?: string[]; active?: string[]; error?: string } };
  };
  // The first event alone: no extra event, the same grants as before.
  expect((await events(customer())).body).toMatchObject({ active: ['full_plan'], newEvents: [] });
  // One purchase = one event; asking again, or from a restored phone, gives the same one.
  const one = await events(withEvents([event('fictional-new-1')]));
  expect(one.body.newEvents).toHaveLength(1);
  expect(one.body.newEvents![0]).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(one.body)).not.toContain('fictional-new-1');
  expect((await events(withEvents([event('fictional-new-1')]))).body.newEvents).toEqual(one.body.newEvents);
  expect((await events(withEvents([event('fictional-new-1')]), '$RCAnonymousID:' + 'b'.repeat(32))).body.newEvents).toEqual(one.body.newEvents);
  // The same transaction listed twice (a replay) is still one event.
  expect((await events(withEvents([event('fictional-new-1'), event('fictional-new-1')]))).body.newEvents).toEqual(one.body.newEvents);
  // A second real purchase is a second event, and only that.
  const two = (await events(withEvents([event('fictional-new-1'), event('fictional-new-2')]))).body.newEvents!;
  expect(two).toHaveLength(2);
  expect(two).toContain(one.body.newEvents![0]);
  // Sandbox, refunded, future-dated, wrong-store and malformed transactions add nothing.
  const bad = [event('s', { environment: 'sandbox' }), event('r', { status: 'refunded' }), event('f', { purchased_at: Date.parse('2027-01-01T00:00:00Z') }),
    event('p', { store: 'promotional' }), event(''), { purchased_at: Date.parse(bought) }, null, 'fictional-new-1'];
  expect((await events(withEvents([event('fictional-new-1'), ...bad]))).body.newEvents).toEqual(one.body.newEvents);
  expect(await confirmedNewEvents(owned(list(bad)), now)).toEqual([]);
  expect(await confirmedNewEvents(owned({ items: { id: 'not-a-list' } }), now)).toEqual([]);
  // The sandbox switch (store review only) admits sandbox transactions and nothing else.
  expect(await confirmedNewEvents(owned(list(bad)), now, true)).toHaveLength(1);
  // A consumable with no confirmed first full plan answers exactly like an unknown buyer.
  const unknown = await events(list([]));
  const alone = await events(list([event('fictional-new-1')]));
  expect(alone).toEqual(unknown);
  expect(alone.status).toBe(403);
  // A printables-only buyer gets no event from a consumable either.
  expect((await events(withEvents([event('fictional-new-1')], customer('dw_printables_topup')))).body.newEvents).toEqual([]);
  // Store off: the same named stop as every other purchase, before RevenueCat is asked.
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const upstream = source(withEvents([event('fictional-new-1')]));
  delete env.APP_PURCHASES_ENABLED;
  const off = await appUnlock(post(), env, upstream, now);
  expect(off.status).toBe(503);
  expect(await off.json()).toMatchObject({ stop: 'DW_STORE_NOT_SET_UP' });
  expect(upstream).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalled();
});

it('real RevenueCat replies: our rejected key is a named stop, and a real customer with no purchase unlocks nothing', async () => {
  const rejected = fixture('v1-subscriber-v2-key-rejected');
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const stopped = await call(post(), source(rejected.body, rejected.status));
  expect(stopped.status).toBe(503);
  expect(await stopped.json()).toMatchObject({ stop: 'REVENUECAT_KEY_REJECTED' });
  expect(error).toHaveBeenCalledWith(expect.stringContaining('REVENUECAT_KEY_REJECTED'));
  const none = fixture('v2-purchases-no-purchase');
  expect(none.body.items).toEqual([]);
  expect((await call(post(), source(none.body, none.status))).status).toBe(403);
  // The same real reply with one owned App Store purchase of the full plan unlocks it.
  const paid = await call(post(), source({ ...none.body, items: [purchase('dw_full_plan')] }));
  expect(paid.status).toBe(200);
  expect((await paid.json()).active).toEqual(['full_plan']);
  expect(productId('dw_full_plan')).toMatch(/^prod/);
});
