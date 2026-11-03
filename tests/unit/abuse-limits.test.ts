import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { NextRequest } from 'next/server';

// Security sweep 3 Nov 2026 (rows 8 and 11): the public forms are limited per IP, marketing
// email has a daily ceiling, and the admin login locks an IP out after 10 wrong passwords.
// The real SQL runs against an in-memory SQLite shaped like D1. No email is ever sent: the
// routes run without a Resend key, and the one sender test uses a fake fetch.

function fakeD1() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(`CREATE TABLE orders (id TEXT, customer_email TEXT, status TEXT, amount_total INTEGER, created_at TEXT)`);
  const stmt = (sql: string, args: unknown[] = []) => ({
    async run() { const r = raw.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes) } }; },
    async all() { return { results: raw.prepare(sql).all(...(args as never[])) as Record<string, unknown>[] }; },
    async first() { return (raw.prepare(sql).get(...(args as never[])) as Record<string, unknown>) ?? null; }
  });
  return { raw, prepare: (sql: string) => ({ ...stmt(sql), bind: (...v: unknown[]) => stmt(sql, v) }) } as any;
}

const state: { db: any; turnstileSecret?: string } = { db: undefined };
vi.mock('@/lib/cloudflare-runtime', () => ({ runtimeEnv: async () => ({ DB: state.db, TURNSTILE_SECRET_KEY: state.turnstileSecret }) }));
vi.mock('next/headers', () => ({ cookies: async () => ({ set() {}, get() { return undefined; } }) }));

import { POST as samplePOST } from '@/app/api/sample/route';
import { POST as signupPOST } from '@/app/api/builder-signup/route';
import { POST as loginPOST } from '@/app/api/admin/login/route';
import { createPasswordHash } from '@/lib/admin-auth';
import { NURTURE_DAILY_SEND_CEILING, runNurture, sendSample } from '@/lib/nurture';

const post = (path: string, body: unknown, ip: string) => new NextRequest(`https://weddingchecklistpdf.com${path}`, {
  method: 'POST', headers: { 'content-type': 'application/json', host: 'weddingchecklistpdf.com', 'cf-connecting-ip': ip }, body: JSON.stringify(body)
});

// Fake Cloudflare siteverify: only the token 'solved' passes. Any other URL is refused (no email can go out).
const verifyCalls: string[] = [];
beforeEach(() => {
  state.db = fakeD1(); state.turnstileSecret = 'turnstile-test-secret'; verifyCalls.length = 0;
  vi.stubGlobal('fetch', async (url: string, init: { body: URLSearchParams }) => {
    if (url !== 'https://challenges.cloudflare.com/turnstile/v0/siteverify') throw new Error(`no network in this test: ${url}`);
    verifyCalls.push(init.body.get('response') ?? '');
    return new Response(JSON.stringify({ success: init.body.get('response') === 'solved' && init.body.get('secret') === 'turnstile-test-secret' }));
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('public forms are limited per IP', () => {
  it('sample: 3 an hour from one IP, then 429 and nothing stored; another IP still works', async () => {
    for (let i = 0; i < 3; i++) expect((await samplePOST(post('/api/sample', { email: `a${i}@example.com`, consent: true, turnstileToken: 'solved' }, '203.0.113.7'))).status).toBe(200);
    const over = await samplePOST(post('/api/sample', { email: 'victim@example.com', consent: true, turnstileToken: 'solved' }, '203.0.113.7'));
    expect(over.status).toBe(429);
    expect(state.db.raw.prepare(`SELECT COUNT(*) AS n FROM builder_signups WHERE email = 'victim@example.com'`).get().n).toBe(0);
    expect((await samplePOST(post('/api/sample', { email: 'b@example.com', consent: true, turnstileToken: 'solved' }, '198.51.100.2'))).status).toBe(200);
    // The IP itself is never stored, only its hash.
    expect(JSON.stringify(state.db.raw.prepare('SELECT * FROM rate_events').all())).not.toContain('203.0.113.7');
  });

  it('builder sign-up: 10 an hour from one IP, then 429', async () => {
    for (let i = 0; i < 10; i++) expect((await signupPOST(post('/api/builder-signup', { email: `s${i}@example.com`, consent: true }, '203.0.113.9'))).status).toBe(200);
    expect((await signupPOST(post('/api/builder-signup', { email: 'x@example.com', consent: true }, '203.0.113.9'))).status).toBe(429);
  });
});

describe('sample form person-check (Turnstile)', () => {
  it('refuses a missing or failed check and stores nothing; fails closed without the secret', async () => {
    for (const token of [undefined, '', 'forged']) {
      const res = await samplePOST(post('/api/sample', { email: 'victim@example.com', consent: true, turnstileToken: token }, '203.0.113.20'));
      expect(res.status).toBe(400);
    }
    expect(state.db.raw.prepare(`SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'builder_signups'`).get().n).toBe(0);
    expect(verifyCalls).toEqual(['forged']); // empty tokens never reach Cloudflare
    state.turnstileSecret = undefined;
    expect((await samplePOST(post('/api/sample', { email: 'a@example.com', consent: true, turnstileToken: 'solved' }, '203.0.113.21'))).status).toBe(503);
    state.turnstileSecret = 'turnstile-test-secret';
    expect((await samplePOST(post('/api/sample', { email: 'a@example.com', consent: true, turnstileToken: 'solved' }, '203.0.113.21'))).status).toBe(200);
  });
});

describe('daily send ceiling', () => {
  it('sends no more than the ceiling in 24 hours; the rest wait for the hourly run', async () => {
    const db = state.db; let calls = 0;
    const fetchImpl = (async () => { calls++; return new Response(JSON.stringify({ id: `m${calls}` }), { status: 200 }); }) as unknown as typeof fetch;
    const env = { DB: db, RESEND_API_KEY: 'k', DOWNLOAD_SIGNING_SECRET: 's' };
    for (let i = 0; i < NURTURE_DAILY_SEND_CEILING; i++) expect((await sendSample(env, `p${i}@example.com`, fetchImpl)).status).toBe('SENT');
    expect(await sendSample(env, 'one-too-many@example.com', fetchImpl)).toEqual({ status: 'CEILING' });
    expect(calls).toBe(NURTURE_DAILY_SEND_CEILING);
    db.raw.prepare(`INSERT INTO builder_signups (email, consent_text, source) VALUES ('later@example.com', 'c', 'sample:checklist')`).run();
    const run = await runNurture(env, Date.now(), fetchImpl);
    expect(run.ceiling).toBe(true);
    expect(calls).toBe(NURTURE_DAILY_SEND_CEILING);
    // A day later there is room again and the waiting sign-up gets its sample.
    db.raw.prepare(`UPDATE email_sends SET sent_at = datetime('now', '-25 hours')`).run();
    expect((await runNurture(env, Date.now(), fetchImpl)).sent).toBeGreaterThan(0);
  });
});

describe('admin login lockout', () => {
  it('locks an IP out after 10 wrong passwords, even for the right one; other IPs unaffected', async () => {
    vi.stubEnv('ADMIN_PASSWORD_HASH', createPasswordHash('correct horse'));
    vi.stubEnv('ADMIN_SESSION_SECRET', 'test-session-secret');
    const ip = '203.0.113.50';
    for (let i = 0; i < 10; i++) expect((await loginPOST(post('/api/admin/login', { password: `guess${i}` }, ip))).status).toBe(401);
    expect((await loginPOST(post('/api/admin/login', { password: 'correct horse' }, ip))).status).toBe(429);
    expect((await loginPOST(post('/api/admin/login', { password: 'correct horse' }, '198.51.100.60'))).status).toBe(200);
  });

  it('fails closed without the database', async () => {
    state.db = undefined;
    expect((await loginPOST(post('/api/admin/login', { password: 'x' }, '203.0.113.1'))).status).toBe(503);
  });
});
