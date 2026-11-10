// Shared fakes for the AI draft tests and the load check: a real SQLite behind the
// D1 shape (so limits are proved against real SQL) and a mocked provider network.
import { DatabaseSync } from 'node:sqlite';
import { BUILDER_SIGNUPS_DDL } from '@/lib/builder-signup';
import type { D1Like } from '@/lib/ai-draft';

export function fakeD1(emails: string[] = []) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(BUILDER_SIGNUPS_DDL);
  const add = sqlite.prepare("INSERT INTO builder_signups (email, consent_text) VALUES (?, 'x')");
  for (const e of emails) add.run(e);
  const stmt = (sql: string, args: unknown[] = []): ReturnType<D1Like['prepare']> => ({
    bind: (...values: unknown[]) => stmt(sql, values),
    first: async () => (sqlite.prepare(sql).get(...(args as never[])) ?? null) as never,
    run: async () => { /^\s*CREATE/i.test(sql) ? sqlite.exec(sql) : sqlite.prepare(sql).run(...(args as never[])); return {}; }
  });
  const all = (sql: string) => { try { return sqlite.prepare(sql).all() as Record<string, unknown>[]; } catch { return []; } };
  return { sqlite, db: { prepare: (sql: string) => stmt(sql) } as D1Like, rows: () => all('SELECT * FROM ai_drafts'), usage: () => all('SELECT * FROM ai_route_usage') };
}

export const GEMINI_URL = /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/([a-z0-9.-]+):generateContent$/;
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export type Reply = { status: number; body: unknown };
export const geminiAnswer = (text: string): Reply => ({ status: 200, body: { candidates: [{ content: { parts: [{ text }] } }], usageMetadata: {} } });
export const geminiQuota = (perDay = false): Reply => ({ status: 429, body: { error: { code: 429, message: 'You exceeded your current quota, please check your plan and billing details.', status: 'RESOURCE_EXHAUSTED', details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: perDay ? 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' : 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier', quotaValue: perDay ? '20' : '10' }] }] } } });
export const orAnswer = (model: string, content: string, cost = 0): Reply => ({ status: 200, body: { model, choices: [{ message: { content } }], usage: { cost } } });
export const orDown = (status = 503, message = 'down'): Reply => ({ status, body: { error: { message } } });

/**
 * A mocked network. `gemini(model)` and `openrouter(model)` decide each reply;
 * every call is recorded with its URL, model and headers. Any other URL throws.
 */
export function fakeNet(opts: { billing?: () => Reply; gemini?: (model: string) => Reply; openrouter?: (model: string) => Reply; billingModel?: string }) {
  const calls: { url: string; provider: 'gemini' | 'openrouter'; model: string; headers: Record<string, string>; body: string }[] = [];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const body = String(init?.body ?? '');
    const g = GEMINI_URL.exec(url);
    let reply: Reply;
    if (g) {
      calls.push({ url, provider: 'gemini', model: g[1], headers, body });
      reply = g[1] === (opts.billingModel ?? 'gemini-pro-latest') ? (opts.billing ?? (() => geminiQuota(true)))() : (opts.gemini ?? (() => geminiQuota()))(g[1]);
    } else if (url === OPENROUTER_URL) {
      const model = JSON.parse(body).model;
      calls.push({ url, provider: 'openrouter', model, headers, body });
      reply = (opts.openrouter ?? (() => orDown()))(model);
    } else throw new Error(`unexpected network call to ${url}`);
    return new Response(JSON.stringify(reply.body), { status: reply.status });
  };
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}
