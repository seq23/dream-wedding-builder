import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import llmConfig from '@/config/llm_routing.json';
import { dayIn, draftPlan, POOLS } from '@/lib/ai-draft';
import { fakeD1, fakeNet, geminiAnswer, geminiQuota, orAnswer, orDown, type Reply } from '@/tests/support/ai-draft-fakes';

const TODAY = '2026-11-10';
const NOW = new Date('2026-11-10T18:00:00Z');
const GOOD = JSON.stringify({ weddingDate: '2027-06-15', guestCount: '200', locations: 'Memphis, TN', season: 'summer', budgetTarget: 'small', budgetMode: 'hard', priorities: ['Food + Bar'], notes: [] });
const GEM = llmConfig.gemini.models.map(m => m.id);
const OR = llmConfig.models.map(m => m.id);

const input = (over: Partial<Parameters<typeof draftPlan>[0]> = {}) => ({ db: undefined, apiKey: 'or-key', geminiKey: 'gem-key', enabled: true, consent: true, email: 'a@example.com', description: '200 guests, June in Memphis, small budget', ip: '1.1.1.1', today: TODAY, now: NOW, salt: 's', log: () => {}, ...over });

describe('AI draft chain: order (a) Gemini, (b) OpenRouter, (c) rules, (d) form', () => {
  it('the billing guard runs first, then Gemini models in order; the first answer wins', async () => {
    const { db } = fakeD1(['a@example.com']);
    const net = fakeNet({ gemini: m => (m === GEM[1] ? geminiAnswer(GOOD) : geminiQuota()) });
    const r = await draftPlan(input({ db, fetchImpl: net.fetchImpl }));
    expect(r.body).toMatchObject({ ok: true, filledBy: 'gemini', model: GEM[1] });
    expect(net.calls.map(c => c.model)).toEqual([llmConfig.gemini.billing_probe.model, GEM[0], GEM[1]]);
    for (const c of net.calls) {
      expect(c.headers['x-goog-api-key']).toBe('gem-key');
      expect(c.url).not.toContain('gem-key');
      expect(c.body).not.toContain('a@example.com');
      expect(c.body).not.toContain('1.1.1.1');
    }
  });

  it('every Gemini model 429: straight on to OpenRouter, each model asked once, no retry', async () => {
    const { db } = fakeD1(['a@example.com']);
    const net = fakeNet({ gemini: () => geminiQuota(), openrouter: m => (m === OR[1] ? orAnswer(m, GOOD) : orDown(429, 'Rate limit exceeded')) });
    const r = await draftPlan(input({ db, fetchImpl: net.fetchImpl }));
    expect(r.body).toMatchObject({ ok: true, filledBy: 'openrouter', model: OR[1] });
    expect(net.calls.map(c => `${c.provider}:${c.model}`)).toEqual([`gemini:${llmConfig.gemini.billing_probe.model}`, ...GEM.map(m => `gemini:${m}`), `openrouter:${OR[0]}`, `openrouter:${OR[1]}`]);
    const orBody = JSON.parse(net.calls.find(c => c.provider === 'openrouter')!.body);
    expect(orBody.provider.max_price).toEqual({ prompt: 0, completion: 0 });
  });

  it('all providers down still returns a filled draft (rules), marked as not AI', async () => {
    const { db } = fakeD1(['a@example.com']);
    const net = fakeNet({ billing: () => ({ status: 503, body: {} }), gemini: () => ({ status: 500, body: {} }), openrouter: () => orDown(502) });
    const r = await draftPlan(input({ db, fetchImpl: net.fetchImpl }));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, filledBy: 'rules', note: 'Filled from your sentence without AI. Check each field.' });
    if (r.body.ok) expect(r.body.draft.guestCount).toBe('200');
  });

  it('a network that throws on every call still returns a filled draft', async () => {
    const { db } = fakeD1(['a@example.com']);
    const r = await draftPlan(input({ db, fetchImpl: (async () => { throw new Error('offline'); }) as never }));
    expect(r.body).toMatchObject({ ok: true, filledBy: 'rules' });
  });
});

describe('AI draft chain: billing guard (proves Gemini is $0)', () => {
  it('a 200 from the no-free-tier model is NAMED STOP [GEMINI_BILLING_ATTACHED]: no Gemini model is called that day', async () => {
    const { db } = fakeD1(['a@example.com', 'b@example.com']);
    const log = vi.fn();
    const net = fakeNet({ billing: () => geminiAnswer('O'), gemini: () => geminiAnswer(GOOD), openrouter: m => orAnswer(m, GOOD) });
    const r = await draftPlan(input({ db, fetchImpl: net.fetchImpl, log }));
    expect(r.body).toMatchObject({ ok: true, filledBy: 'openrouter' });
    expect(log.mock.calls.flat().join(' ')).toContain('NAMED STOP [GEMINI_BILLING_ATTACHED]');
    expect(log.mock.calls.flat().join(' ')).toContain('gemini:billing_attached');
    expect(net.calls.filter(c => GEM.includes(c.model))).toEqual([]);
    // Cached for the Central day: the second draft does not probe again and still skips Gemini.
    await draftPlan(input({ db, email: 'b@example.com', ip: '2.2.2.2', fetchImpl: net.fetchImpl }));
    expect(net.calls.filter(c => c.model === llmConfig.gemini.billing_probe.model)).toHaveLength(1);
    expect(net.calls.filter(c => GEM.includes(c.model))).toEqual([]);
  });

  it('a 429 quota proves the free tier once per Central day; a new day probes again', async () => {
    const { db } = fakeD1(['a@example.com', 'b@example.com', 'c@example.com']);
    const net = fakeNet({ gemini: () => geminiAnswer(GOOD) });
    await draftPlan(input({ db, fetchImpl: net.fetchImpl }));
    await draftPlan(input({ db, email: 'b@example.com', fetchImpl: net.fetchImpl }));
    expect(net.calls.filter(c => c.model === 'gemini-pro-latest')).toHaveLength(1);
    await draftPlan(input({ db, email: 'c@example.com', today: '2026-11-11', now: new Date('2026-11-11T18:00:00Z'), fetchImpl: net.fetchImpl }));
    expect(net.calls.filter(c => c.model === 'gemini-pro-latest')).toHaveLength(2);
  });

  it('an unproven guard (network error) skips Gemini and retries only after 15 minutes', async () => {
    const { db } = fakeD1(['a@example.com', 'b@example.com', 'c@example.com']);
    const net = fakeNet({ billing: () => ({ status: 500, body: {} }), gemini: () => geminiAnswer(GOOD), openrouter: m => orAnswer(m, GOOD) });
    expect((await draftPlan(input({ db, fetchImpl: net.fetchImpl }))).body).toMatchObject({ filledBy: 'openrouter' });
    await draftPlan(input({ db, email: 'b@example.com', now: new Date(NOW.getTime() + 60_000), fetchImpl: net.fetchImpl }));
    expect(net.calls.filter(c => c.model === 'gemini-pro-latest')).toHaveLength(1);
    await draftPlan(input({ db, email: 'c@example.com', now: new Date(NOW.getTime() + 16 * 60_000), fetchImpl: net.fetchImpl }));
    expect(net.calls.filter(c => c.model === 'gemini-pro-latest')).toHaveLength(2);
    expect(net.calls.filter(c => GEM.includes(c.model))).toEqual([]);
  });
});

describe('AI draft chain: ceilings', () => {
  it('every ceiling is at most 80% of its free limit, day and minute', () => {
    for (const [id, p] of Object.entries(POOLS)) {
      expect(p.ceiling_day, id).toBeGreaterThan(0);
      expect(p.ceiling_day, id).toBeLessThanOrEqual(Math.floor(p.rpd * 0.8));
      expect(p.ceiling_minute, id).toBeGreaterThan(0);
      expect(p.ceiling_minute, id).toBeLessThanOrEqual(Math.floor(p.rpm * 0.8));
    }
    for (const m of llmConfig.gemini.models) expect(POOLS[m.pool], m.id).toBeDefined();
    expect(llmConfig.capacity.read_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  for (const [poolId, pool] of Object.entries(POOLS)) {
    it(`${poolId}: the day ceiling holds and the call after it is not made`, async () => {
      const { db, sqlite } = fakeD1(['a@example.com']);
      sqlite.exec('CREATE TABLE IF NOT EXISTS ai_route_usage (key TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0, note TEXT, at INTEGER NOT NULL DEFAULT 0)');
      sqlite.prepare('INSERT INTO ai_route_usage (key, n) VALUES (?, ?)').run(`day|${poolId}|${dayIn(pool.resets_tz, NOW)}`, pool.ceiling_day);
      const net = fakeNet({ gemini: () => geminiAnswer(GOOD), openrouter: m => orAnswer(m, GOOD) });
      await draftPlan(input({ db, fetchImpl: net.fetchImpl }));
      const asked = net.calls.filter(c => (pool.provider === 'gemini' ? `gemini:${c.model}` === poolId : c.provider === 'openrouter'));
      expect(asked).toEqual([]);
      const row = sqlite.prepare('SELECT n FROM ai_route_usage WHERE key = ?').get(`day|${poolId}|${dayIn(pool.resets_tz, NOW)}`) as { n: number };
      expect(row.n).toBe(pool.ceiling_day);
    });
  }

  it('the minute ceiling holds: past it, the model is skipped without a call', async () => {
    const emails = Array.from({ length: 30 }, (_, i) => `m${i}@example.com`);
    const { db } = fakeD1(emails);
    const pool = POOLS[`gemini:${GEM[0]}`];
    const net = fakeNet({ gemini: m => (m === GEM[0] ? geminiAnswer(GOOD) : geminiQuota()), openrouter: m => orAnswer(m, GOOD) });
    for (const [i, email] of emails.entries()) await draftPlan(input({ db, email, ip: `10.0.0.${i}`, fetchImpl: net.fetchImpl }));
    expect(net.calls.filter(c => c.model === GEM[0])).toHaveLength(pool.ceiling_minute);
  });

  it('a daily-quota 429 marks that model spent until its midnight: no more calls to it today', async () => {
    const { db } = fakeD1(['a@example.com', 'b@example.com']);
    const net = fakeNet({ gemini: m => (m === GEM[0] ? geminiQuota(true) : geminiAnswer(GOOD)) });
    await draftPlan(input({ db, fetchImpl: net.fetchImpl }));
    await draftPlan(input({ db, email: 'b@example.com', fetchImpl: net.fetchImpl }));
    expect(net.calls.filter(c => c.model === GEM[0])).toHaveLength(1);
  });

  it('Gemini counts in Pacific days (its reset), OpenRouter in UTC days', () => {
    expect(POOLS[`gemini:${GEM[0]}`].resets_tz).toBe('America/Los_Angeles');
    expect(POOLS['openrouter:free'].resets_tz).toBe('UTC');
    expect(dayIn('America/Los_Angeles', new Date('2026-11-11T05:00:00Z'))).toBe('2026-11-10');
  });
});

describe('No model key or model URL in any client bundle', () => {
  // Follows the static (non-type) imports of every 'use client' file; none may reach
  // the router, a provider endpoint or a model key name.
  const ROOT = process.cwd();
  const resolve = (from: string, spec: string) => {
    const base = spec.startsWith('@/') ? path.join(ROOT, spec.slice(2)) : path.resolve(path.dirname(from), spec);
    for (const ext of ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.tsx']) if (existsSync(base + ext) && !base.endsWith('/') && (ext || /\.\w+$/.test(base))) return base + ext;
    return null;
  };
  const walk = (dir: string, out: string[] = []) => { for (const d of readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, d.name); if (d.isDirectory()) walk(p, out); else if (/\.(tsx?|mjs)$/.test(d.name)) out.push(p); } return out; };
  it('client files and everything they import are free of model secrets and endpoints', () => {
    const clients = ['app', 'components'].flatMap(d => walk(path.join(ROOT, d))).filter(f => /^\s*['"]use client['"]/.test(readFileSync(f, 'utf8')));
    expect(clients.length).toBeGreaterThan(5);
    expect(clients.some(f => f.endsWith('components/AiDraftCard.tsx'))).toBe(true);
    const seen = new Set<string>();
    const queue = [...clients];
    while (queue.length) {
      const f = queue.shift()!;
      if (seen.has(f)) continue;
      seen.add(f);
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/^\s*import\s+(?!type\b)(?:[^'"]*?from\s*)?['"]([^'"]+)['"]/gm)) {
        if (!m[1].startsWith('.') && !m[1].startsWith('@/')) continue;
        const r = resolve(f, m[1]);
        if (r && !/\.json$/.test(r)) queue.push(r);
      }
    }
    for (const f of seen) {
      const rel = path.relative(ROOT, f);
      expect(rel).not.toBe('scripts/llm/free_router.mjs');
      const src = readFileSync(f, 'utf8');
      expect(src, rel).not.toMatch(/GEMINI_API_KEY|OPENROUTER_API_KEY|generativelanguage\.googleapis\.com|openrouter\.ai\/api/);
    }
  });
});
