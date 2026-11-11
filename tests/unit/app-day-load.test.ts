import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { expect, it } from 'vitest';
import { planShare } from '@/lib/plan-share';
// @ts-expect-error standalone Node CLI also exports the replay for regression coverage
import { previewOrigin, replayAppDay } from '../../scripts/load/app-day.mjs';

it('replays the complete day through the real handler and SQL, detects read corruption, and cleans up', async () => {
  const raw = new DatabaseSync(':memory:');
  raw.exec(readFileSync('migrations/0009_plan_shares.sql', 'utf8'));
  const statement = (sql: string, args: unknown[] = []) => ({
    async run() { return { meta: { changes: Number(raw.prepare(sql).run(...args as never[]).changes) } }; },
    async first() { return raw.prepare(sql).get(...args as never[]) as Record<string, unknown> ?? null; }
  });
  const db = { prepare(sql: string) { return { ...statement(sql), bind: (...args: unknown[]) => statement(sql, args) }; } };
  let now = Date.parse('2026-11-11T06:00:00Z');
  let corrupt = false;
  const options = {
    origin: 'https://app-load-isolated.example.workers.dev',
    pause: async (ms: number) => { now += ms; },
    fetcher: async (url: string, init: RequestInit) => {
      const result = await planShare(new Request(url, init), db, true, now);
      if (corrupt && init.method === 'GET' && result.status === 200) return Response.json({ ciphertext: 'damaged', revision: 1 });
      return result;
    }
  };
  try {
    expect(await replayAppDay(options)).toEqual({ opens: 3000, writes: 1000 });
    expect(raw.prepare('SELECT COUNT(*) AS n FROM app_plan_shares').get()?.n).toBe(0);
    expect(raw.prepare('SELECT requests, writes FROM app_share_capacity').get()).toEqual({ requests: 4002, writes: 1001 });
    corrupt = true;
    await expect(replayAppDay(options)).rejects.toThrow('Plan read lost content or revision');
    expect(raw.prepare('SELECT COUNT(*) AS n FROM app_plan_shares').get()?.n).toBe(0);
    expect(() => previewOrigin('https://weddingchecklistpdf.com')).toThrow();
    expect(() => previewOrigin('https://example.workers.dev@weddingchecklistpdf.com')).toThrow();
  } finally { raw.close(); }
}, 20000);

it('refuses a failed free path and reports a missing preview instead of passing with no work', async () => {
  const { spawnSync } = await import('node:child_process');
  const env = { ...process.env };
  delete env.APP_LOAD_PREVIEW_ORIGIN;
  const result = spawnSync(process.execPath, ['scripts/load/app-day.mjs'], { env, encoding: 'utf8' });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('NAMED STOP [APP_DAY_LOAD_FAILED]');
  let calls = 0;
  await expect(replayAppDay({
    origin: 'https://app-load-isolated.example.workers.dev',
    pause: async () => {},
    fetcher: async () => { calls++; return Response.json({}, { status: 429 }); },
  })).rejects.toThrow('Expected 201, received 429');
  expect(calls).toBe(1);
});

it('rejects updates that advance revisions but retain the initial ciphertext, then deletes the share', async () => {
  let ciphertext = ''; let revision = 1; let deleted = false; let updates = 0;
  await expect(replayAppDay({
    origin: 'https://app-load-isolated.example.workers.dev',
    pause: async () => {},
    fetcher: async (_url: string, init: RequestInit) => {
      if (init.method === 'POST') {
        ciphertext = JSON.parse(String(init.body)).ciphertext;
        return Response.json({ id: 'a'.repeat(64), revision }, { status: 201 });
      }
      if (init.method === 'PUT') {
        updates++;
        return Response.json({ revision: ++revision });
      }
      if (init.method === 'DELETE') { deleted = true; return Response.json({ ok: true }); }
      return deleted ? Response.json({}, { status: 404 }) : Response.json({ ciphertext, revision });
    },
  })).rejects.toThrow('Plan read lost content or revision');
  expect(updates).toBe(1);
  expect(deleted).toBe(true);
});
