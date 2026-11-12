import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { appPlanReach, type MetricsEnv } from '@/lib/app-metrics';

let db: DatabaseSync;
let env: MetricsEnv;
const now = Date.parse('2026-11-12T02:00:00Z');
const request = (id = 'a'.repeat(32), host = 'weddingchecklistpdf.com') => new Request(`https://${host}/api/app-plan-reach`, {
  method: 'POST', headers: { 'x-dw-installation': id, 'cf-connecting-ip': '203.0.113.1' },
});
beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec(readFileSync('migrations/0010_app_metrics.sql', 'utf8'));
  const statement = (sql: string, values: unknown[] = []) => ({
    async run() { return { meta: { changes: Number(db.prepare(sql).run(...values as never[]).changes) } }; },
    async first() { return db.prepare(sql).get(...values as never[]) as Record<string, unknown> ?? null; },
  });
  env = { APP_METRICS_ENABLED: 'true', DB: { prepare(sql: string) { return { ...statement(sql), bind: (...values: unknown[]) => statement(sql, values) }; } } };
});
afterEach(() => { db.close(); vi.restoreAllMocks(); });

it('deduplicates first reach, stores only a hash, and returns NULL for unmeasured reach', async () => {
  const sql = readFileSync('apps/mobile/release/scorecard-reader.sql', 'utf8').replaceAll(':since_ms', String(now - 30 * 86400000));
  expect(db.prepare(sql).get()?.n).toBeNull();
  expect((await appPlanReach(request(), env, now)).status).toBe(204);
  expect((await appPlanReach(request(), env, now + 1000)).status).toBe(204);
  const rows = db.prepare('SELECT * FROM app_plan_reach').all();
  expect(rows).toHaveLength(1);
  expect(rows[0].reached_at).toBe(now);
  expect(rows[0].installation_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(rows)).not.toContain('a'.repeat(32));
  expect(db.prepare(sql).get()?.n).toBe(0);
  for (let i = 0; i < 99; i++) db.prepare('INSERT INTO app_plan_reach VALUES (?, ?)').run(String(i), now);
  for (let i = 0; i < 3; i++) db.prepare('INSERT INTO app_confirmed_unlocks VALUES (?, ?)').run(String(i), now);
  db.prepare('INSERT INTO app_confirmed_unlocks VALUES (?, ?)').run('old', now - 31 * 86400000);
  expect(db.prepare(sql).get()?.n).toBe(3);
});

it('rejects disabled, preview-host, malformed and over-limit reach, and fails visibly without its migration', async () => {
  expect((await appPlanReach(request(), {})).status).toBe(503);
  expect((await appPlanReach(request(), { ...env, APP_METRICS_ENABLED: 'false' })).status).toBe(503);
  expect((await appPlanReach(request('a'.repeat(32), 'preview.example'), env)).status).toBe(503);
  expect((await appPlanReach(request('email@example.invalid'), env)).status).toBe(400);
  expect((await appPlanReach(new Request(request(), { body: 'arbitrary content' }), env)).status).toBe(400);
  expect(db.prepare('SELECT COUNT(*) n FROM app_plan_reach').get()?.n).toBe(0);
  for (let i = 0; i < 60; i++) expect((await appPlanReach(request(i.toString(16).padStart(32, '0')), env, now)).status).toBe(204);
  expect((await appPlanReach(request('f'.repeat(32)), env, now)).status).toBe(429);
  db.exec('DELETE FROM rate_events; DROP TABLE app_plan_reach');
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  expect((await appPlanReach(request(), env, now)).status).toBe(503);
  expect(log).toHaveBeenCalledWith(expect.stringContaining('APP_METRICS_STORAGE_UNAVAILABLE'));
  const sql = readFileSync('apps/mobile/release/scorecard-reader.sql', 'utf8').replaceAll(':since_ms', '0');
  expect(() => db.prepare(sql).get()).toThrow();
});
