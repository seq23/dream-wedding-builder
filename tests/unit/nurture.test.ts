import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { MAILING_ADDRESS, REVIEW_ASK_SINCE, SEQUENCE, emailHash, optOut, renderEmail, runNurture, sendSample, unsubscribeUrl, verifyUnsubscribe, type NurtureDB } from '@/lib/nurture';

// A D1-shaped wrapper over an in-memory SQLite, so the real SQL in lib/nurture.ts runs.
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

const DAY = 86_400_000;
function resend() {
  const sent: Array<{ to: string; subject: string; text: string; headers: Record<string, string> }> = [];
  const fetchImpl = (async (_url: string, init: { body: string }) => {
    const b = JSON.parse(init.body); sent.push({ to: b.to[0], subject: b.subject, text: b.text, headers: b.headers });
    return new Response(JSON.stringify({ id: `m${sent.length}` }), { status: 200 });
  }) as unknown as typeof fetch;
  return { sent, fetchImpl };
}
const envFor = (DB: NurtureDB) => ({ DB, RESEND_API_KEY: 'k', DOWNLOAD_SIGNING_SECRET: 's' });
const signup = (db: ReturnType<typeof fakeD1>, email: string, created: string) =>
  db.raw.prepare(`INSERT INTO builder_signups (email, consent_text, source, created_at) VALUES (?, 'c', 'sample:checklist', ?)`).run(email, created);

describe('free sample -> email -> paid', () => {
  it('sends the sample once, then one product email per 3 days, then stops when the steps run out', async () => {
    const db = fakeD1(); const { sent, fetchImpl } = resend(); const env = envFor(db);
    const t0 = Date.parse('2026-11-02T12:00:00Z');
    await sendSample(env, 'a@example.com', fetchImpl); // creates tables
    await sendSample(env, 'a@example.com', fetchImpl); // double submit
    signup(db, 'a@example.com', '2026-11-02 12:00:00');
    expect(sent.map((s) => s.subject)).toEqual([SEQUENCE[0].subject]);
    expect((await runNurture(env, t0 + DAY, fetchImpl)).sent).toBe(0); // too soon after the sample
    for (let d = 1; d <= 30; d++) await runNurture(env, Date.now() + d * DAY, fetchImpl);
    expect(sent.map((s) => s.subject)).toEqual(SEQUENCE.map((s) => s.subject));
  });

  it('stops on purchase and on unsubscribe', async () => {
    const db = fakeD1(); const { sent, fetchImpl } = resend(); const env = envFor(db);
    await sendSample(env, 'buyer@example.com', fetchImpl); signup(db, 'buyer@example.com', '2026-10-01 00:00:00');
    await sendSample(env, 'gone@example.com', fetchImpl); signup(db, 'gone@example.com', '2026-10-01 00:00:00');
    db.raw.prepare(`INSERT INTO orders VALUES ('o1', 'BUYER@example.com', 'PAID', 900, '2026-10-01 00:00:00')`).run();
    await optOut(db, await emailHash('gone@example.com'));
    sent.length = 0;
    await runNurture(env, Date.now() + 10 * DAY, fetchImpl);
    expect(sent).toEqual([]);
    expect(await sendSample(env, 'gone@example.com', fetchImpl)).toEqual({ status: 'OPTED_OUT' });
  });

  it('asks a buyer for a review exactly once, only for orders after the ask existed', async () => {
    const db = fakeD1(); const { sent, fetchImpl } = resend(); const env = envFor(db);
    db.raw.prepare(`INSERT INTO orders VALUES ('old', 'old@example.com', 'PAID', 900, '2026-07-11 00:00:00')`).run();
    db.raw.prepare(`INSERT INTO orders VALUES ('new', 'new@example.com', 'PAID', 900, ?)`).run(REVIEW_ASK_SINCE.replace('00:00:00', '09:00:00'));
    const later = Date.parse('2026-11-20T00:00:00Z');
    await runNurture(env, later, fetchImpl); await runNurture(env, later + 10 * DAY, fetchImpl);
    expect(sent.map((s) => s.to)).toEqual(['new@example.com']);
  });

  it('every email carries a working one-click unsubscribe and the mailing address', async () => {
    const hash = await emailHash('a@example.com');
    const url = await unsubscribeUrl('s', hash);
    expect(url).not.toContain('example.com');
    const u = new URL(url);
    expect(await verifyUnsubscribe('s', u.searchParams.get('id')!, u.searchParams.get('t')!)).toBe(true);
    expect(await verifyUnsubscribe('s', u.searchParams.get('id')!, '0'.repeat(32))).toBe(false);
    for (const step of SEQUENCE) {
      const { html, text } = renderEmail(step, url);
      for (const body of [html, text]) { expect(body).toContain(MAILING_ADDRESS); expect(body).toContain(url.replace(/&/g, body === html ? '&amp;' : '&')); }
    }
  });

  it('refuses with a named stop instead of sending nothing silently', async () => {
    const run = await runNurture({ DB: fakeD1() }, Date.now(), resend().fetchImpl);
    expect(run.stop).toMatch(/^NAMED STOP \[NO_RESEND_KEY\]/);
  });
});
