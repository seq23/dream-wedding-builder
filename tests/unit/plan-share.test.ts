import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { planShare, SHARE_MAX_BYTES, SHARE_DAILY_REQUESTS, SHARE_DAILY_WRITES, SHARE_IP_LIMIT } from '@/lib/plan-share';

let raw: DatabaseSync;
const now = Date.parse('2026-11-11T06:00:00Z');
const cipher = Buffer.alloc(40, 17).toString('base64');
function db() {
  const statement = (sql: string, args: unknown[] = []) => ({
    async run() { return { meta: { changes: Number(raw.prepare(sql).run(...args as never[]).changes) } }; },
    async first() { return raw.prepare(sql).get(...args as never[]) as Record<string, unknown> ?? null; }
  });
  return { prepare(sql: string) { return { ...statement(sql), bind: (...args: unknown[]) => statement(sql, args) }; } };
}
function request(method = 'POST', id = '', body: unknown = { ciphertext: cipher }, ip = '203.0.113.1') {
  return new Request('https://weddingchecklistpdf.com/api/plan-share' + (id ? '?id=' + id : ''), {
    method, headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
    ...(method === 'GET' || method === 'DELETE' ? {} : { body: JSON.stringify(body) })
  });
}
const call = (req: Request, time = now) => planShare(req, db(), true, time);
async function create() { return (await (await call(request())).json()) as { id: string; revision: number }; }
beforeEach(() => {
  raw = new DatabaseSync(':memory:');
  raw.exec(readFileSync('migrations/0009_plan_shares.sql', 'utf8'));
});
afterEach(() => raw.close());

it('is off by default and never writes without a migration', async () => {
  expect((await planShare(request(), db(), false)).status).toBe(503);
  expect(raw.prepare('SELECT COUNT(*) AS n FROM app_plan_shares').get()?.n).toBe(0);
  raw.exec('DROP TABLE app_plan_shares');
  expect((await call(request())).status).toBe(503);
});
it('stores only opaque content under distinct random ids; read, compare-and-swap and revoke work', async () => {
  const first = await create(); const second = await create();
  expect(first.id).toMatch(/^[a-f0-9]{64}$/); expect(second.id).not.toBe(first.id);
  expect(await (await call(request('GET', first.id))).json()).toEqual({ ciphertext: cipher, revision: 1 });
  expect((await call(request('PUT', first.id, { ciphertext: cipher, revision: 1 }))).status).toBe(200);
  expect((await call(request('PUT', first.id, { ciphertext: cipher, revision: 1 }))).status).toBe(409);
  expect((await (await call(request('GET', first.id))).json()).revision).toBe(2);
  expect((await call(request('DELETE', first.id))).status).toBe(200);
  expect((await call(request('GET', first.id))).status).toBe(404);
  expect((await call(request('GET', second.id))).status).toBe(200);
  expect(JSON.stringify(raw.prepare('SELECT * FROM rate_events').all())).not.toContain('203.0.113.1');
});
it('unknown and expired ids have the same response; malformed and plaintext bodies are refused', async () => {
  const { id } = await create();
  const unknown = await call(request('GET', 'f'.repeat(64)));
  const expired = await call(request('GET', id), now + 91 * 86400000);
  expect(unknown.status).toBe(404); expect(expired.status).toBe(404);
  expect(await unknown.json()).toEqual(await expired.json());
  expect((await call(request('POST', '', { ciphertext: 'private wedding text' }))).status).toBe(400);
  expect((await call(request('POST', '', null))).status).toBe(400);
});
it('enforces 64 KB on streamed bytes even without content-length, including multibyte input', async () => {
  const huge = request('POST', '', { ciphertext: 'é'.repeat(SHARE_MAX_BYTES / 2) });
  expect(huge.headers.has('content-length')).toBe(false);
  expect((await call(huge)).status).toBe(413);
  const claimed = request(); claimed.headers.set('content-length', String(SHARE_MAX_BYTES + 1));
  expect((await call(claimed)).status).toBe(413);
  expect(raw.prepare('SELECT COUNT(*) AS n FROM app_plan_shares').get()?.n).toBe(0);
});
it('caps each connection and each global day; the next day reopens', async () => {
  for (let i = 0; i < SHARE_IP_LIMIT.max; i++) expect((await call(request('GET', 'f'.repeat(64)))).status).toBe(404);
  expect((await call(request())).status).toBe(429);
  expect((await call(request('POST', '', { ciphertext: cipher }, '203.0.113.2'))).status).toBe(201);
  raw.prepare('UPDATE app_share_capacity SET requests = ?').run(SHARE_DAILY_REQUESTS);
  expect((await call(request('GET', 'f'.repeat(64), undefined, '203.0.113.2'))).status).toBe(429);
  raw.prepare('UPDATE app_share_capacity SET requests = 0, writes = ?').run(SHARE_DAILY_WRITES);
  expect((await call(request('POST', '', { ciphertext: cipher }, '203.0.113.2'))).status).toBe(429);
  expect((await call(request('POST', '', { ciphertext: cipher }), now + 86400000)).status).toBe(201);
});
