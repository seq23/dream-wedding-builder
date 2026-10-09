import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state: { db: any } = { db: undefined };
vi.mock('@/lib/cloudflare-runtime', () => ({ runtimeEnv: async () => ({ DB: state.db }) }));

import { POST } from '@/app/api/builder-signup/route';
import { CONSENT_TEXT, normalizeEmail } from '@/lib/builder-signup';

function fakeDb() {
  const calls: { sql: string; binds: unknown[] }[] = [];
  return {
    calls,
    prepare(sql: string) {
      const entry = { sql, binds: [] as unknown[] };
      calls.push(entry);
      return { bind: (...values: unknown[]) => { entry.binds = values; return { run: async () => ({}) }; }, run: async () => ({}) };
    }
  };
}

const req = (body: unknown) => new NextRequest('https://weddingchecklistpdf.com/api/builder-signup', { method: 'POST', headers: { 'content-type': 'application/json', host: 'weddingchecklistpdf.com' }, body: JSON.stringify(body) });

afterEach(() => { state.db = undefined; });

describe('builder signup', () => {
  it('normalizes and rejects bad addresses', () => {
    expect(normalizeEmail('  Ana@Example.COM ')).toBe('ana@example.com');
    expect(normalizeEmail('nope')).toBeNull();
  });

  it('stores a consented email with the consent wording', async () => {
    const db = fakeDb(); state.db = db;
    const res = await POST(req({ email: 'Ana@example.com', consent: true }));
    expect(res.status).toBe(200);
    const insert = db.calls.find((c) => c.sql.startsWith('INSERT INTO builder_signups'));
    expect(insert?.binds).toEqual(['ana@example.com', CONSENT_TEXT, 'free-wedding-planner', 'weddingchecklistpdf.com']);
    expect(db.calls[0].sql).toContain('CREATE TABLE IF NOT EXISTS builder_signups');
  });

  it('refuses without consent and stores nothing', async () => {
    const db = fakeDb(); state.db = db;
    const res = await POST(req({ email: 'ana@example.com' }));
    expect(res.status).toBe(400);
    expect(db.calls).toHaveLength(0);
  });

  it('is a 503, not a silent success, when storage is missing', async () => {
    const res = await POST(req({ email: 'ana@example.com', consent: true }));
    expect(res.status).toBe(503);
  });

  it('consent wording mentions unsubscribing', () => {
    expect(CONSENT_TEXT.toLowerCase()).toContain('unsubscribe');
  });
});
