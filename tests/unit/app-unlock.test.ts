import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { appUnlock, confirmedEntitlements, APP_ASSETS, type UnlockEnv } from '@/lib/app-unlock';
import { createDownloadToken } from '@/lib/fulfillment';

const now = Date.parse('2026-11-11T16:00:00Z');
const bought = '2026-11-10T16:00:00Z';
const identity = '$RCAnonymousID:' + 'a'.repeat(32);
let raw: DatabaseSync;
let env: UnlockEnv;
function customer(product = 'dw_full_plan', names = ['full_plan'], sandbox = false) {
  return { subscriber: {
    entitlements: Object.fromEntries(names.map(n => [n, { product_identifier: product, purchase_date: bought, expires_date: null }])),
    non_subscriptions: { [product]: [{ id: 'fictional-transaction', purchase_date: bought, is_sandbox: sandbox, store: 'app_store' }] },
  } };
}
function post(id = identity) { return new Request('https://weddingchecklistpdf.com/api/app-unlock', { method: 'POST', headers: { authorization: `Bearer ${id}`, 'cf-connecting-ip': '203.0.113.1' } }); }
const source = (value: unknown, status = 200) => vi.fn<typeof fetch>().mockImplementation(async () => Response.json(value, { status }));
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
  expect((await call(post(), source(customer('dw_full_plan', ['full_plan'], true)))).status).toBe(403);
  expect((await call(post(), source(customer('dw_printables_topup', ['printables'])))).status).toBe(200);
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
  const refused = await call(post(), source({ subscriber: { entitlements: { full_plan: true } } }));
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
  expect(upstream).toHaveBeenCalledWith(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(identity)}`, expect.objectContaining({ headers: { Authorization: 'Bearer test-server-secret', Accept: 'application/json' }, signal: expect.any(AbortSignal), redirect: 'error' }));
  expect(JSON.stringify(body)).not.toContain(identity);
  const download = await call(new Request('https://weddingchecklistpdf.com' + body.downloads[0].path), upstream);
  expect(download.status).toBe(200);
  expect(await download.text()).toBe('fictional paid fixture');
  expect(env.PRODUCT_RELEASES!.get).toHaveBeenCalledExactlyOnceWith('plans/checklist-full-plan-v1.json');
  expect(upstream).toHaveBeenCalledTimes(1);
});
it('a real confirmed printable purchase alone permits printables; full-plan buyers cannot download them', async () => {
  const paid = await (await call(post(), source(customer('dw_printables_topup', ['printables'])))).json();
  expect(paid.active).toEqual(['printables']);
  expect(paid.downloads).toHaveLength(1);
  expect(paid.downloads[0].id).toBe('printables');
  expect((await call(new Request('https://weddingchecklistpdf.com' + paid.downloads[0].path))).status).toBe(200);
  expect(env.PRODUCT_RELEASES!.get).toHaveBeenCalledWith('app/printables-v1.zip');
  expect(confirmedEntitlements(customer('dw_planner_printables', ['full_plan', 'printables', 'day_of_kit']), now)).toEqual(['full_plan', 'printables', 'day_of_kit']);
  expect(confirmedEntitlements(customer('dw_full_plan', ['printables']), now)).toEqual([]);
});
it('sandbox, expired, malformed, refunded, promotional and unsupported transactions grant nothing', () => {
  expect(confirmedEntitlements(customer('dw_full_plan', ['full_plan'], true), now)).toEqual([]);
  expect(confirmedEntitlements(customer('unknown'), now)).toEqual([]);
  expect(confirmedEntitlements(customer('dw_new_event'), now)).toEqual([]);
  for (const expiry of ['2020-01-01', undefined, 'not-a-date']) {
    const value = customer(); Object.assign(value.subscriber.entitlements.full_plan, { expires_date: expiry });
    expect(confirmedEntitlements(value, now)).toEqual([]);
  }
  for (const change of [{ refunded_at: bought }, { store: 'promotional' }, { purchase_date: 'invalid' }, { is_sandbox: undefined }]) {
    const value = customer(); Object.assign(value.subscriber.non_subscriptions.dw_full_plan[0], change);
    expect(confirmedEntitlements(value, now)).toEqual([]);
  }
  expect(confirmedEntitlements(null, now)).toEqual([]);
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
  expect(upstream).toHaveBeenCalledTimes(20);
  raw.exec('DELETE FROM rate_events');
  expect((await call(post(), source({}, 500))).status).toBe(503);
  expect((await call(post(), vi.fn<typeof fetch>().mockRejectedValue(new Error('timeout')))).status).toBe(503);
  expect((await call(post(), source('malformed'))).status).toBe(403);
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
  expect(cancelled).toHaveBeenCalledOnce();
  expect(env.PRODUCT_RELEASES!.get).not.toHaveBeenCalled();
});
