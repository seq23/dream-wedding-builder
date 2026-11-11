import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state: { db: any } = { db: undefined };
vi.mock('@/lib/cloudflare-runtime', () => ({ runtimeEnv: async () => ({ DB: state.db }) }));

import { POST } from '@/app/api/builder-signup/route';
import { CONSENT_TEXT, NO_MARKETING_TEXT, normalizeEmail } from '@/lib/builder-signup';

function fakeDb() {
  const calls: { sql: string; binds: unknown[] }[] = [];
  return {
    calls,
    prepare(sql: string) {
      const entry = { sql, binds: [] as unknown[] };
      calls.push(entry);
      return { bind: (...values: unknown[]) => { entry.binds = values; return { run: async () => ({ meta: { changes: 1 } }), first: async () => null }; }, run: async () => ({ meta: { changes: 1 } }) };
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

  it('stores a ticked email with the consent wording and marketing on', async () => {
    const db = fakeDb(); state.db = db;
    const res = await POST(req({ email: 'Ana@example.com', marketing: true }));
    expect(res.status).toBe(200);
    const insert = db.calls.find((c) => c.sql.startsWith('INSERT INTO builder_signups'));
    expect(insert?.binds).toEqual(['ana@example.com', CONSENT_TEXT, 'free-wedding-planner', 'weddingchecklistpdf.com', 1]);
    expect(db.calls.findIndex((c) => c.sql.includes('CREATE TABLE IF NOT EXISTS builder_signups'))).toBeLessThan(db.calls.findIndex((c) => c.sql.startsWith('INSERT INTO builder_signups')));
  });

  it('an email without the tick is stored as no-marketing, never as consented', async () => {
    const db = fakeDb(); state.db = db;
    const res = await POST(req({ email: 'ana@example.com' }));
    expect(res.status).toBe(200);
    const insert = db.calls.find((c) => c.sql.startsWith('INSERT INTO builder_signups'));
    expect(insert?.binds).toEqual(['ana@example.com', NO_MARKETING_TEXT, 'free-wedding-planner', 'weddingchecklistpdf.com', 0]);
    expect(NO_MARKETING_TEXT).not.toBe(CONSENT_TEXT);
  });

  it('the old gate\'s compulsory tick (consent: true) still counts as a tick', async () => {
    const db = fakeDb(); state.db = db;
    await POST(req({ email: 'ana@example.com', consent: true }));
    expect(db.calls.find((c) => c.sql.startsWith('INSERT INTO builder_signups'))?.binds?.[4]).toBe(1);
  });

  it('is a 503, not a silent success, when storage is missing', async () => {
    const res = await POST(req({ email: 'ana@example.com', consent: true }));
    expect(res.status).toBe(503);
  });

  it('consent wording mentions unsubscribing', () => {
    expect(CONSENT_TEXT.toLowerCase()).toContain('unsubscribe');
  });
});
