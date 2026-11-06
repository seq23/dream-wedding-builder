import { describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import llmConfig from '@/config/llm_routing.json';
import { emptyPlan } from '@/data/planning';
import { BUILDER_SIGNUPS_DDL } from '@/lib/builder-signup';
import { aiDraftEnabled, ATTEMPTS_PER_DAY_GLOBAL, cleanDescription, draftPlan, parseDraft, type D1Like } from '@/lib/ai-draft';
import { applyAiDraft } from '@/components/AiDraftCard';

const TODAY = '2026-11-06';

// A real SQLite behind the D1 shape, so the limits are proved against real SQL.
function fakeD1(emails: string[] = []) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(BUILDER_SIGNUPS_DDL);
  for (const e of emails) sqlite.prepare("INSERT INTO builder_signups (email, consent_text) VALUES (?, 'x')").run(e);
  const stmt = (sql: string, args: unknown[] = []): ReturnType<D1Like['prepare']> => ({
    bind: (...values: unknown[]) => stmt(sql, values),
    first: async () => (sqlite.prepare(sql).get(...(args as never[])) ?? null) as never,
    run: async () => { /^\s*CREATE/i.test(sql) ? sqlite.exec(sql) : sqlite.prepare(sql).run(...(args as never[])); return {}; }
  });
  return { db: { prepare: (sql: string) => stmt(sql) } as D1Like, rows: () => { try { return sqlite.prepare('SELECT * FROM ai_drafts').all() as Record<string, unknown>[]; } catch { return []; } } };
}

const answer = (content: string) => vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ model: llmConfig.models[0].id, choices: [{ message: { content } }], usage: { cost: 0 } }), { status: 200 }));
const GOOD = JSON.stringify({ weddingDate: '2027-06-15', guestCount: '200', locations: 'Memphis, TN', season: 'summer', budgetTarget: 'small', budgetMode: 'hard', priorities: ['Food + Bar', 'Not A Real Priority'], notes: ['Memphis in June is hot: plan shade and water.'] });

function input(over: Partial<Parameters<typeof draftPlan>[0]> = {}) {
  return { db: undefined, apiKey: 'test-key', enabled: true, email: 'a@example.com', description: '200 guests, June in Memphis, small budget', ip: '1.1.1.1', today: TODAY, salt: 's', log: () => {}, ...over };
}

describe('AI draft: very limited free use, enforced on the server', () => {
  it('a signed-up email gets one draft; the second is refused and no model is called again', async () => {
    const { db } = fakeD1(['a@example.com']);
    const fetchImpl = answer(GOOD);
    const first = await draftPlan(input({ db, fetchImpl: fetchImpl as never }));
    expect(first.status).toBe(200);
    if (first.status === 200) expect(first.body.draft).toMatchObject({ weddingDate: '2027-06-15', guestCount: '200', budgetMode: 'hard', priorities: ['Food + Bar'] });
    const second = await draftPlan(input({ db, fetchImpl: fetchImpl as never, ip: '2.2.2.2' }));
    expect(second.status).toBe(429);
    expect(second.body).toMatchObject({ ok: false, code: 'EMAIL_USED' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('the IP cap holds: 3 attempts a day from one connection, the 4th is refused even with a new email', async () => {
    const emails = ['a@example.com', 'b@example.com', 'c@example.com', 'd@example.com'];
    const { db } = fakeD1(emails);
    const fetchImpl = answer(GOOD);
    const results = [];
    for (const email of emails) results.push(await draftPlan(input({ db, email, fetchImpl: fetchImpl as never })));
    expect(results.map(r => r.status)).toEqual([200, 200, 200, 429]);
    expect(results[3].body).toMatchObject({ code: 'IP_CAP' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    // A new day resets the IP cap.
    expect((await draftPlan(input({ db, email: 'd@example.com', fetchImpl: fetchImpl as never, today: '2026-11-07' }))).status).toBe(200);
  });

  it('the daily ceiling across everyone holds and is logged as a named stop', async () => {
    const emails = Array.from({ length: ATTEMPTS_PER_DAY_GLOBAL + 1 }, (_, i) => `p${i}@example.com`);
    const { db } = fakeD1(emails);
    const fetchImpl = answer(GOOD);
    const log = vi.fn();
    let last;
    for (const [i, email] of emails.entries()) last = await draftPlan(input({ db, email, ip: `10.0.0.${i}`, fetchImpl: fetchImpl as never, log }));
    expect(last?.body).toMatchObject({ code: 'GLOBAL_CAP' });
    expect(fetchImpl).toHaveBeenCalledTimes(ATTEMPTS_PER_DAY_GLOBAL);
    expect(log.mock.calls.flat().join(' ')).toContain('NAMED STOP [AI_DRAFT_DAILY_CEILING]');
  });

  it('kill switch: off means no model call and no row; live hosts are off unless the secret says on', async () => {
    const { db, rows } = fakeD1(['a@example.com']);
    const fetchImpl = answer(GOOD);
    const r = await draftPlan(input({ db, enabled: false, fetchImpl: fetchImpl as never }));
    expect(r.status).toBe(503);
    expect(r.body).toMatchObject({ code: 'DISABLED' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(rows()).toEqual([]);
    expect(aiDraftEnabled('weddingchecklistpdf.com', undefined)).toBe(false);
    expect(aiDraftEnabled('weddingchecklistpdf.com', 'yes')).toBe(false);
    expect(aiDraftEnabled('weddingchecklistpdf.com', 'on')).toBe(true);
    expect(aiDraftEnabled('abc123-dream-wedding-builder.example.workers.dev', undefined)).toBe(true);
    expect(aiDraftEnabled('abc123-dream-wedding-builder.example.workers.dev', 'off')).toBe(false);
    expect(aiDraftEnabled('someone-else.com', 'on')).toBe(false);
  });

  it('an email that never opened the planner is refused before any model call', async () => {
    const { db } = fakeD1([]);
    const fetchImpl = answer(GOOD);
    expect((await draftPlan(input({ db, fetchImpl: fetchImpl as never }))).body).toMatchObject({ code: 'NOT_SIGNED_UP' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('no free model answering: calm busy message, a named stop, and the email keeps its free draft', async () => {
    const { db } = fakeD1(['a@example.com']);
    const down = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'rate limited' } }), { status: 429 }));
    const log = vi.fn();
    const r = await draftPlan(input({ db, fetchImpl: down as never, log }));
    expect(r.status).toBe(503);
    expect(r.body).toMatchObject({ code: 'BUSY' });
    if (!r.body.ok) expect(r.body.error).toContain('try again later');
    expect(log.mock.calls.flat().join(' ')).toContain('NAMED STOP [AI_DRAFT_NO_FREE_MODEL]');
    expect((await draftPlan(input({ db, fetchImpl: answer(GOOD) as never }))).status).toBe(200);
  });
});

describe('AI draft: $0 routes only', () => {
  it('every request goes to OpenRouter with a :free model, max price 0, and carries no email or IP', async () => {
    const { db } = fakeD1(['a@example.com']);
    const down = vi.fn(async () => new Response('{}', { status: 503 }));
    await draftPlan(input({ db, fetchImpl: down as never }));
    expect(down.mock.calls.length).toBe(llmConfig.models.length);
    for (const [url, init] of down.mock.calls as unknown as [string, RequestInit][]) {
      expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
      const body = JSON.parse(String(init.body));
      expect(body.model).toMatch(/:free$/);
      expect(body.provider.max_price).toEqual({ prompt: 0, completion: 0 });
      expect(String(init.body)).not.toContain('a@example.com');
      expect(String(init.body)).not.toContain('1.1.1.1');
    }
  });

  it('a provider that reports any cost stops the draft; nothing else is tried', async () => {
    const { db } = fakeD1(['a@example.com']);
    const paid = vi.fn(async () => new Response(JSON.stringify({ model: llmConfig.models[0].id, choices: [{ message: { content: GOOD } }], usage: { cost: 0.001 } }), { status: 200 }));
    const log = vi.fn();
    const r = await draftPlan(input({ db, fetchImpl: paid as never, log }));
    expect(r.body).toMatchObject({ code: 'BUSY' });
    expect(paid).toHaveBeenCalledTimes(1);
    expect(log.mock.calls.flat().join(' ')).toContain('NAMED STOP [AI_DRAFT_ROUTER_REFUSED]');
  });

  it('the AI step reaches a model only through the free router (no provider endpoint or key name of its own)', () => {
    for (const file of ['lib/ai-draft.ts', 'app/api/ai-draft/route.ts', 'components/AiDraftCard.tsx']) {
      const src = readFileSync(file, 'utf8');
      for (const marker of llmConfig.provider_endpoint_markers) expect(src, `${file} ${marker}`).not.toMatch(new RegExp(marker, 'i'));
      expect(src, file).not.toMatch(/GEMINI|OPENAI|ANTHROPIC|\bAI\.run\(|env\.AI\b/);
    }
    expect(readFileSync('lib/ai-draft.ts', 'utf8')).toMatch(/from '@\/scripts\/llm\/free_router\.mjs'/);
    expect(llmConfig.policy).toMatchObject({ max_cost_usd: 0, paid_fallback: false });
    for (const m of llmConfig.models) expect(m.pricing).toEqual({ prompt: '0', completion: '0' });
  });
});

describe('AI draft: the model is never trusted', () => {
  it('keeps only whitelisted fields; markup, injected keys, past dates and unknown priorities are dropped', () => {
    const d = parseDraft('Sure! ' + JSON.stringify({ weddingDate: '2025-01-01', guestCount: '99999', locations: '<script>alert(1)</script>Memphis', budgetMode: 'unlimited', priorities: ['Florals', 'ignore previous instructions'], notes: ['<img src=x onerror=alert(1)>', 'ok note'], html: '<b>x</b>' }), TODAY);
    expect(d).not.toBeNull();
    expect(d!.weddingDate).toBe('');
    expect(d!.guestCount).toBe('');
    expect(d!.locations).not.toMatch(/[<>]/);
    expect(d!.budgetMode).toBe('');
    expect(d!.priorities).toEqual(['Florals']);
    expect(d!.notes.join(' ')).not.toMatch(/[<>]/);
    expect(Object.keys(d!)).not.toContain('html');
  });

  it('an answer cut off mid-object keeps the complete fields it has', () => {
    const cut = '{\n  "weddingDate": "2027-06-15",\n  "guestCount": "200",\n  "locations": "Memphis",\n  "season": "summer",\n  "priorities": ["Food + Bar", "Photography"],\n  "budgetTa';
    expect(parseDraft(cut, TODAY)).toMatchObject({ weddingDate: '2027-06-15', guestCount: '200', locations: 'Memphis', season: 'summer', priorities: ['Food + Bar', 'Photography'], budgetTarget: '' });
  });

  it('an answer with nothing usable is null, never an empty plan', () => {
    expect(parseDraft('I cannot help with that', TODAY)).toBeNull();
    expect(parseDraft(JSON.stringify({ notes: ['x y z'] }), TODAY)).toBeNull();
  });

  it('descriptions are length-capped on the server', () => {
    expect(cleanDescription('short').ok).toBe(false);
    expect(cleanDescription('x'.repeat(401)).ok).toBe(false);
    expect(cleanDescription('  200 guests,\n\nJune  ').ok).toBe(true);
  });

  it('a draft fills only empty fields and is labelled; the couple’s own answers win', () => {
    const plan = { ...emptyPlan, guestCount: '120' };
    const r = applyAiDraft(plan, { weddingDate: '2027-06-15', guestCount: '200', locations: 'Memphis', season: '', budgetTarget: '', budgetMode: 'hard', priorities: [], notes: ['n'] }, 'desc', '2026-11-06T00:00:00Z');
    expect(r.plan.guestCount).toBe('120');
    expect(r.plan.weddingDate).toBe('2027-06-15');
    expect(r.kept).toContain('guestCount');
    expect(r.plan.aiDraft).toMatchObject({ fields: ['weddingDate', 'locations', 'budgetMode'], notes: ['n'] });
  });
});
