import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { NextRequest } from 'next/server';
import { renderToStaticMarkup } from 'react-dom/server';

// The standout-idea form keeps every idea (27 Nov 2026). Before, /api/submit-trend answered
// "we received your idea" with mode local-contract and stored nothing. These tests call the
// real route handler and the real /admin page against an in-memory SQLite built from the real
// migrations, and break the store in the ways production can break.

type Fake = { raw: DatabaseSync; failWhen: RegExp | null; noRowFor: RegExp | null; prepare(sql: string): any };
function fakeD1(): Fake {
  const raw = new DatabaseSync(':memory:');
  for (const file of readdirSync('migrations').sort()) raw.exec(readFileSync(`migrations/${file}`, 'utf8'));
  const db: Fake = {
    raw, failWhen: null, noRowFor: null,
    prepare(sql: string) {
      if (db.failWhen?.test(sql)) throw new Error('D1_ERROR: storage is unavailable');
      const stmt = (args: unknown[] = []) => ({
        async run() { const r = raw.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes) } }; },
        async all() { return { results: raw.prepare(sql).all(...(args as never[])) as Record<string, unknown>[] }; },
        async first() { if (db.noRowFor?.test(sql)) return null; return (raw.prepare(sql).get(...(args as never[])) as Record<string, unknown>) ?? null; }
      });
      return { ...stmt(), bind: (...v: unknown[]) => stmt(v) };
    }
  };
  return db;
}

const SECRET = 'test-session-secret';
const state: { db: Fake | undefined; cookie: string | undefined } = { db: undefined, cookie: undefined };
vi.mock('@/lib/cloudflare-runtime', () => ({ runtimeEnv: async () => ({ DB: state.db, AI_DRAFT_SALT: 'test-salt' }) }));
vi.mock('next/headers', () => ({ cookies: async () => ({ set(_n: string, v: string) { state.cookie = v; }, get() { return state.cookie ? { value: state.cookie } : undefined; } }) }));
class Redirected extends Error { constructor(public to: string) { super(`redirect ${to}`); } }
vi.mock('next/navigation', () => ({ redirect: (to: string) => { throw new Redirected(to); } }));

import { POST } from '@/app/api/submit-trend/route';
import Admin from '@/app/admin/page';
import { IDEAS_PAGE_SIZE, IDEA_BODY_MAX_BYTES, IDEA_NOT_SAVED } from '@/lib/trend-ideas';
import { RECEIVED, sendIdea } from '@/components/TrendSubmitForm';

const post = (body: unknown, headers: Record<string, string> = {}) => POST(new NextRequest('https://weddingchecklistpdf.com/api/submit-trend', {
  method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body)
}));
const idea = (name: string, extra: Record<string, unknown> = {}) => ({ idea_name: name, description: 'Guests release paper lanterns over the lake', category: 'Reception', ...extra });
const rows = () => state.db!.raw.prepare(`SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'trend_ideas'`).get()!.n
  ? state.db!.raw.prepare('SELECT * FROM trend_ideas ORDER BY id').all() as Record<string, unknown>[] : [];
function ownerCookie(secret = SECRET, role = 'owner', exp = Math.floor(Date.now() / 1000) + 600) {
  const payload = Buffer.from(JSON.stringify({ role, exp })).toString('base64url');
  return `${payload}.${crypto.createHmac('sha256', secret).update(payload).digest('base64url')}`;
}
async function adminHtml(search: Record<string, string> = {}) {
  return renderToStaticMarkup(await Admin({ searchParams: Promise.resolve(search) }));
}
/** The visible text of the ideas section only, so a title elsewhere on the page proves nothing. */
function ideasSection(html: string) {
  const m = html.match(/<section data-testid="admin-ideas"[\s\S]*?<\/section>/);
  if (!m) throw new Error('no ideas section on the page');
  return m[0];
}

beforeEach(() => {
  state.db = fakeD1(); state.cookie = undefined;
  vi.stubEnv('ADMIN_SESSION_SECRET', SECRET);
  vi.stubGlobal('fetch', async (url: string) => { throw new Error(`no network in this test: ${url}`); });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('the idea is kept before the visitor is told so', () => {
  it('a sent idea is one row with the time and a salted hash, never the raw address', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(Date.parse('2026-11-27T16:05:00Z'));
    const res = await post(idea('Lantern send-off', { source_type: 'TikTok', source_url: 'https://example.com/v/1', why_cool: 'Glows', price_this_out: 'on', budget_feel: 'Affordable' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, status: 'received_for_review' });
    const [row] = rows();
    expect(rows()).toHaveLength(1);
    expect(row).toMatchObject({ submitted_at: '2026-11-27T16:05:00.000Z', idea_name: 'Lantern send-off', category: 'Reception', source_type: 'TikTok', source_url: 'https://example.com/v/1', why_cool: 'Glows', price_this_out: 1, budget_feel: 'Affordable', is_test: 0 });
    expect(row.ip_hash).toBe(crypto.createHash('sha256').update('test-salt:ip:203.0.113.7').digest('hex'));
    expect(JSON.stringify(state.db!.raw.prepare('SELECT * FROM trend_ideas').all())).not.toContain('203.0.113.7');
  });

  it('a request cannot mark its own idea as a test row, and "false" is not a yes', async () => {
    await post(idea('Sneaky', { is_test: 1, price_this_out: 'false' }), { 'x-dw-test': '1' });
    expect(rows()[0]).toMatchObject({ is_test: 0, price_this_out: 0 });
  });

  it('the store down at the write: 503 with the plain "couldn\'t save" line, never the success answer', async () => {
    state.db!.failWhen = /INSERT INTO trend_ideas/;
    const res = await post(idea('Lost idea'));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: IDEA_NOT_SAVED });
    expect(JSON.stringify(body)).not.toMatch(/received/i);
    state.db!.failWhen = null;
    expect(rows()).toHaveLength(0);
  });

  it('a write that returns no row is not a save: 503, never "received"', async () => {
    state.db!.noRowFor = /INSERT INTO trend_ideas/;
    const res = await post(idea('Ghost'));
    expect(res.status).toBe(503);
    expect((await res.json()).ok).toBe(false);
  });

  it('the table cannot be made (store read-only): 503, never "received"', async () => {
    state.db!.failWhen = /CREATE TABLE IF NOT EXISTS trend_ideas/;
    expect((await post(idea('No table'))).status).toBe(503);
  });

  it('no database at all: 503 with the same plain line', async () => {
    state.db = undefined;
    const res = await post(idea('Nowhere'));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, error: IDEA_NOT_SAVED });
  });
});

describe('size and shape are checked at the server', () => {
  it('a body over the cap is refused 413 before it is parsed, uses no try and keeps nothing', async () => {
    const big = idea('Huge', { description: 'x'.repeat(IDEA_BODY_MAX_BYTES) });
    expect((await post(big)).status).toBe(413);
    // A lying content-length does not get a big body in.
    expect((await post(big, { 'content-length': '10' })).status).toBe(413);
    expect(rows()).toHaveLength(0);
    expect(state.db!.raw.prepare(`SELECT COUNT(*) AS n FROM rate_events WHERE bucket = 'submit-trend'`).get()!.n).toBe(0);
  });

  it('a body exactly at the cap is accepted; each field is cut to its form limit', async () => {
    const base = JSON.stringify(idea('Edge', { why_cool: '' }));
    const pad = IDEA_BODY_MAX_BYTES - base.length;
    const exact = JSON.stringify(idea('Edge', { why_cool: 'y'.repeat(pad) }));
    expect(new TextEncoder().encode(exact).length).toBe(IDEA_BODY_MAX_BYTES);
    expect((await post(exact)).status).toBe(200);
    expect(String(rows()[0].why_cool)).toHaveLength(750);
  });

  it('JSON that is not an object, and whitespace-only required fields, are refused with nothing kept', async () => {
    expect((await post('[1,2]')).status).toBe(400);
    expect((await post('"text"')).status).toBe(400);
    expect((await post('{nope')).status).toBe(400);
    expect((await post(idea('   '))).status).toBe(400);
    expect(rows()).toHaveLength(0);
  });
});

describe('what the visitor reads', () => {
  const answer = (status: number, body: unknown) => (async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })) as unknown as typeof fetch;
  it('"received" only on an ok answer that says ok', async () => {
    expect(await sendIdea({}, answer(200, { ok: true, status: 'received_for_review' }))).toBe(RECEIVED);
    expect(await sendIdea({}, answer(200, { ok: false }))).toBe(IDEA_NOT_SAVED);
    expect(await sendIdea({}, answer(200, '<html>edge error</html>'))).toBe(IDEA_NOT_SAVED);
  });
  it('a refusal shows the server\'s own reason; offline shows "couldn\'t save"', async () => {
    expect(await sendIdea({}, answer(503, { ok: false, error: IDEA_NOT_SAVED }))).toBe(IDEA_NOT_SAVED);
    expect(await sendIdea({}, answer(429, { ok: false, error: 'Too many tries' }))).toBe('Too many tries');
    expect(await sendIdea({}, (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch)).toBe(IDEA_NOT_SAVED);
  });
  it('the real route\'s outage answer, fed to the form, never reads as received', async () => {
    state.db!.failWhen = /INSERT INTO trend_ideas/;
    const res = await post(idea('Outage'));
    expect(await sendIdea({}, (async () => res) as unknown as typeof fetch)).toBe(IDEA_NOT_SAVED);
  });
});

describe('/admin ideas list', () => {
  it('a signed-out, forged, expired or wrong-role visitor is sent to the login and sees no idea', async () => {
    await post(idea('Private name: Jane at the lake'));
    for (const cookie of [undefined, ownerCookie('wrong-secret'), ownerCookie(SECRET, 'owner', Math.floor(Date.now() / 1000) - 1), ownerCookie(SECRET, 'guest')]) {
      state.cookie = cookie;
      await expect(adminHtml()).rejects.toMatchObject({ to: '/admin/login' });
    }
    vi.stubEnv('ADMIN_SESSION_SECRET', '');
    state.cookie = ownerCookie(SECRET);
    await expect(adminHtml()).rejects.toMatchObject({ to: '/admin/login' });
  });

  it('the signed-in owner reads every idea, newest first, with the TEST mark and text escaped', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.parse('2026-11-27T15:00:00Z')); await post(idea('First idea'), { 'cf-connecting-ip': '198.51.100.1' });
    vi.setSystemTime(Date.parse('2026-11-27T16:00:00Z')); await post(idea('<script>alert(1)</script>'), { 'cf-connecting-ip': '198.51.100.2' });
    vi.setSystemTime(Date.parse('2026-11-27T17:00:00Z')); await post(idea('TEST — preview check'), { 'cf-connecting-ip': '198.51.100.3' });
    state.db!.raw.prepare(`UPDATE trend_ideas SET is_test = 1 WHERE idea_name LIKE 'TEST —%'`).run();
    state.cookie = ownerCookie();
    const section = ideasSection(await adminHtml());
    expect(section).toContain('3 ideas in all, newest first.');
    const order = ['TEST — preview check', '&lt;script&gt;alert(1)&lt;/script&gt;', 'First idea'].map(t => section.indexOf(t));
    expect(order.every(i => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(section).not.toContain('<script>');
    expect((section.match(/data-testid="admin-idea-test"/g) ?? []).length).toBe(1);
    expect(section).toContain('Nov 27, 2026, 11:00 AM CT');
    expect(section).not.toContain('198.51.100');
  });

  it('none sent yet says so; a store that cannot be read says unknown, never "none"', async () => {
    state.cookie = ownerCookie();
    expect(ideasSection(await adminHtml())).toContain('No ideas have been sent yet.');
    state.db!.failWhen = /FROM trend_ideas/;
    const broken = ideasSection(await adminHtml());
    expect(broken).toContain('data-testid="admin-ideas-unreadable"');
    expect(broken).not.toContain('No ideas have been sent yet.');
    state.db = undefined;
    expect(ideasSection(await adminHtml())).toContain('unknown, not empty');
  });

  it('more than a page: the newest page, then "Older ideas" reaches every remaining one', async () => {
    for (let i = 1; i <= IDEAS_PAGE_SIZE + 1; i++) await post(idea(`Idea number ${i}.`), { 'cf-connecting-ip': `10.0.${i}.1` });
    state.cookie = ownerCookie();
    const first = ideasSection(await adminHtml());
    expect((first.match(/data-testid="admin-idea"/g) ?? []).length).toBe(IDEAS_PAGE_SIZE);
    expect(first).toContain(`Idea number ${IDEAS_PAGE_SIZE + 1}.`);
    expect(first).not.toContain('Idea number 1.');
    const older = first.match(/href="\/admin\?ideas_before=(\d+)#ideas"/);
    expect(older).not.toBeNull();
    const second = ideasSection(await adminHtml({ ideas_before: older![1] }));
    expect((second.match(/data-testid="admin-idea"/g) ?? []).length).toBe(1);
    expect(second).toContain('Idea number 1.');
    expect(second).not.toContain('Older ideas');
  });
});
