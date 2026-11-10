import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runNurture, sendSample, type NurtureDB } from '@/lib/nurture';
import { judge } from '@/lib/email-health';

// Rule 0 (7 Nov 2026): a refused email must be a named stop someone sees, never a quiet success.
function fakeD1(): NurtureDB & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  raw.exec(`CREATE TABLE orders (id TEXT, customer_email TEXT, status TEXT, amount_total INTEGER, created_at TEXT)`);
  const stmt = (sql: string, args: unknown[] = []) => ({
    async run() { const r = raw.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes) } }; },
    async all() { return { results: raw.prepare(sql).all(...(args as never[])) as Record<string, unknown>[] }; },
    async first() { return (raw.prepare(sql).get(...(args as never[])) as Record<string, unknown>) ?? null; }
  });
  return { raw, prepare: (sql: string) => ({ ...stmt(sql), bind: (...v: unknown[]) => stmt(sql, v) }) } as never;
}
const refuse = (async () => new Response(JSON.stringify({ statusCode: 401, message: 'API key is invalid' }), { status: 401 })) as unknown as typeof fetch;
const ok = (async () => new Response(JSON.stringify({ id: 'm1' }), { status: 200 })) as unknown as typeof fetch;
const envFor = (DB: NurtureDB) => ({ DB, RESEND_API_KEY: 'k', DOWNLOAD_SIGNING_SECRET: 's' });

describe('a refused email is a named stop', () => {
  it('stops the run by name, records it, and the health check goes 503', async () => {
    const db = fakeD1();
    expect((await sendSample(envFor(db), 'r@example.com', refuse)).status).toBe('FAILED');
    db.raw.prepare(`INSERT INTO builder_signups (email, consent_text, source) VALUES ('r@example.com', 'c', 'sample:checklist')`).run();
    const run = await runNurture(envFor(db), Date.now(), refuse);
    expect(run.stop).toMatch(/^NAMED STOP \[RESEND_SEND_FAILED\] 1 email\(s\) not sent \(Resend HTTP 401: API key is invalid\)/);
    expect(run.sent).toBe(0);
    const last = db.raw.prepare('SELECT ran_at, sent, failed, stop FROM nurture_runs ORDER BY ran_at DESC LIMIT 1').get() as never;
    expect(judge(last).ok).toBe(false);
    expect(judge(last).status).toMatch(/RESEND_SEND_FAILED/);
  });
  it('a clean run is OK; no run, or an old one, is a named stop', async () => {
    const db = fakeD1();
    const run = await runNurture(envFor(db), Date.now(), ok);
    expect(run.stop).toBeNull();
    const last = db.raw.prepare('SELECT ran_at, sent, failed, stop FROM nurture_runs ORDER BY ran_at DESC LIMIT 1').get() as never;
    expect(judge(last).ok).toBe(true);
    expect(judge(null).status).toMatch(/NURTURE_NOT_RUNNING/);
    expect(judge({ ran_at: '2026-01-01 00:00:00', sent: 0, failed: 0, stop: null }).status).toMatch(/NURTURE_NOT_RUNNING/);
  });
});
