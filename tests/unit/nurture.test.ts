import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { NO_MARKETING_TEXT, storeBuilderSignup } from '@/lib/builder-signup';
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

  it('an email given without the marketing tick gets no marketing email at all; a ticked one and a pre-change one do', async () => {
    const db = fakeD1(); const { sent, fetchImpl } = resend(); const env = envFor(db);
    const now = Date.parse('2026-11-10T12:00:00Z');
    await optOut(db, await emailHash('nobody@example.com')); // creates tables
    // Stored through the real writer, exactly as the sign-up route does.
    await storeBuilderSignup(db as never, { email: 'unticked@example.com', source: 'free-wedding-planner', host: 'h', marketing: false });
    await storeBuilderSignup(db as never, { email: 'ticked@example.com', source: 'free-wedding-planner', host: 'h', marketing: true });
    await storeBuilderSignup(db as never, { email: 'unticked-sample@example.com', source: 'sample:checklist', host: 'h', marketing: false });
    // A row from before the change: the column is NULL, and its compulsory tick still counts.
    db.raw.prepare(`INSERT INTO builder_signups (email, consent_text, source) VALUES ('legacy@example.com', 'c', 'free-wedding-planner')`).run();
    db.raw.prepare(`UPDATE builder_signups SET created_at = '2026-11-10 11:30:00'`).run();
    expect((db.raw.prepare(`SELECT marketing_consent AS m FROM builder_signups WHERE email = 'legacy@example.com'`).get() as { m: unknown }).m).toBeNull();

    for (let day = 0; day < 20; day++) await runNurture(env, now + day * DAY, fetchImpl);
    const to = new Set(sent.map((s) => s.to));
    expect(to.has('unticked@example.com')).toBe(false);
    expect(to.has('unticked-sample@example.com')).toBe(false);
    expect(to.has('ticked@example.com')).toBe(true);
    expect(to.has('legacy@example.com')).toBe(true);

    // Ticking later turns marketing on; coming back without the tick never turns it off.
    await storeBuilderSignup(db as never, { email: 'unticked@example.com', source: 'free-wedding-planner', host: 'h', marketing: true });
    await storeBuilderSignup(db as never, { email: 'ticked@example.com', source: 'free-wedding-planner', host: 'h', marketing: false });
    const flag = (email: string) => (db.raw.prepare('SELECT marketing_consent AS m FROM builder_signups WHERE email = ?').get(email) as { m: unknown }).m;
    expect(flag('unticked@example.com')).toBe(1);
    expect(flag('ticked@example.com')).toBe(1);
  });

  it('a database from before the change gets the column added, without touching its rows', async () => {
    const db = fakeD1();
    db.raw.exec(`CREATE TABLE builder_signups (email TEXT PRIMARY KEY, consent_text TEXT NOT NULL, source TEXT, host TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, unsubscribed_at TEXT)`);
    db.raw.prepare(`INSERT INTO builder_signups (email, consent_text, source) VALUES ('old@example.com', 'old wording', 'free-wedding-planner')`).run();
    await storeBuilderSignup(db as never, { email: 'new@example.com', source: 'free-wedding-planner', host: 'h', marketing: false });
    const rows = db.raw.prepare('SELECT email, consent_text, marketing_consent AS m FROM builder_signups ORDER BY email').all() as Array<{ email: string; consent_text: string; m: unknown }>;
    expect(rows).toEqual([{ email: 'new@example.com', consent_text: NO_MARKETING_TEXT, m: 0 }, { email: 'old@example.com', consent_text: 'old wording', m: null }]);
  });

  it('a free-planner sign-up gets exactly one welcome and never a product series', async () => {
    const db = fakeD1(); const { sent, fetchImpl } = resend(); const env = envFor(db);
    const now = Date.parse('2026-11-10T12:00:00Z');
    await optOut(db, await emailHash('gone@example.com')); // creates tables
    const planner = (email: string, created: string, source = 'free-wedding-planner') =>
      db.raw.prepare(`INSERT INTO builder_signups (email, consent_text, source, created_at) VALUES (?, 'c', ?, ?)`).run(email, source, created);
    planner('new@example.com', '2026-11-10 11:30:00');
    planner('tool@example.com', '2026-11-09 13:00:00', 'free-wedding-planner:weddingseatingchartmaker.com');
    planner('old@example.com', '2026-11-06 09:00:00'); // signed up before the 48-hour window
    planner('gone@example.com', '2026-11-10 11:00:00'); // opted out
    planner('buyer@example.com', '2026-11-10 11:00:00');
    db.raw.prepare(`INSERT INTO orders VALUES ('o1', 'buyer@example.com', 'PAID', 900, '2026-11-10 11:10:00')`).run();
    planner('sampled@example.com', '2026-11-10 11:00:00'); // asked for the sample too: the series owns them
    await sendSample(env, 'sampled@example.com', fetchImpl); sent.length = 0;

    const first = await runNurture(env, now, fetchImpl);
    expect(first.sent).toBe(2); // the welcome is counted in the run's result
    expect(sent.map((s) => s.to).sort()).toEqual(['new@example.com', 'tool@example.com']);
    for (const mail of sent) {
      expect(mail.text).toContain('https://weddingchecklistpdf.com/free-wedding-planner');
      expect(mail.text).toContain(MAILING_ADDRESS);
      expect(mail.headers['List-Unsubscribe']).toMatch(/^<https:\/\/weddingchecklistpdf\.com\/api\/unsubscribe\?id=[0-9a-f]{64}&t=[0-9a-f]{32}>$/);
      expect(mail.text).toContain(mail.headers['List-Unsubscribe'].slice(1, -1));
    }
    // Hourly re-runs and a month of later runs: no second welcome, and no seq step, ever.
    await runNurture(env, now + 3_600_000, fetchImpl);
    for (let d = 1; d <= 30; d++) await runNurture(env, now + d * DAY, fetchImpl);
    const kinds = async (email: string) => (db.raw.prepare('SELECT kind FROM email_sends WHERE email_hash = ? ORDER BY kind').all(await emailHash(email)) as Array<{ kind: string }>).map((r) => r.kind);
    expect(await kinds('new@example.com')).toEqual(['welcome']);
    expect(await kinds('tool@example.com')).toEqual(['welcome']);
    for (const email of ['old@example.com', 'gone@example.com', 'buyer@example.com']) expect((await kinds(email)).filter((k) => k !== 'review_ask')).toEqual([]);
    expect(await kinds('sampled@example.com')).toEqual(SEQUENCE.map((s) => s.kind)); // the series, without a welcome on top
  });

  it('refuses with a named stop instead of sending nothing silently', async () => {
    const run = await runNurture({ DB: fakeD1() }, Date.now(), resend().fetchImpl);
    expect(run.stop).toMatch(/^NAMED STOP \[NO_RESEND_KEY\]/);
  });
});
