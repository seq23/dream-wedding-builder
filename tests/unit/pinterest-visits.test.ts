import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { recordPinterestVisit, pinterestVisit, LAUNCH_VARIANT, _resetForTests } from '@/lib/pinterest-visits';

// The Pinterest drip's weekly measurement reads D1 pinterest_visits. These run the
// REAL upsert against SQLite with the real migration: a tagged request must add one
// to its variant's count, an untagged one must write nothing, and no column may
// hold anything that identifies the visitor.

const SQL = await initSqlJs();
const NOW = new Date('2026-10-16T12:00:00Z');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Pinterest for iOS/12.0';

function d1(db: any) {
  const exec = (sql: string, args: any[]) => {
    const stmt = db.prepare(sql); stmt.bind(args);
    const rows: any[] = []; while (stmt.step()) rows.push(stmt.getAsObject()); stmt.free();
    return rows;
  };
  const make = (sql: string, args: any[] = []) => ({
    bind: (...a: any[]) => make(sql, a),
    run: async () => { exec(sql, args); return { meta: { changes: db.getRowsModified() } }; }
  });
  return { prepare: (sql: string) => make(sql) };
}
const req = (url: string, ua = UA, method = 'GET') => new Request(url, { method, headers: { 'user-agent': ua, 'cf-connecting-ip': '203.0.113.9' } });
const rows = (raw: any) => { const r = raw.exec('SELECT day, utm_content, path, visits FROM pinterest_visits ORDER BY utm_content'); return r.length ? r[0].values : []; };

let raw: any; let DB: any;
beforeEach(() => {
  _resetForTests();
  raw = new SQL.Database();
  raw.run(readFileSync('migrations/0003_pinterest_visits.sql', 'utf8'));
  DB = d1(raw);
});

describe('pinterest page-view log', () => {
  it('a pinterest-tagged request increments the count for its variant', async () => {
    const url = 'https://weddingchecklistpdf.com/guides/budget?utm_source=pinterest&utm_medium=pin&utm_content=budget-v3';
    expect(await recordPinterestVisit(DB, req(url), NOW)).toBe(true);
    expect(rows(raw)).toEqual([['2026-10-16', 'budget-v3', '/guides/budget', 1]]);
    expect(await recordPinterestVisit(DB, req(url), NOW)).toBe(true);
    expect(rows(raw)).toEqual([['2026-10-16', 'budget-v3', '/guides/budget', 2]]);
    await recordPinterestVisit(DB, req('https://weddingchecklistpdf.com/?utm_source=pinterest'), NOW);
    expect(rows(raw)).toEqual([['2026-10-16', LAUNCH_VARIANT, '/', 1], ['2026-10-16', 'budget-v3', '/guides/budget', 2]]);
  });

  it('an untagged request records nothing', async () => {
    for (const url of ['https://weddingchecklistpdf.com/guides/budget', 'https://weddingchecklistpdf.com/?utm_source=google&utm_content=budget-v3', 'https://weddingchecklistpdf.com/?utm_content=budget-v3']) {
      expect(await recordPinterestVisit(DB, req(url), NOW)).toBe(false);
    }
    expect(await recordPinterestVisit(DB, req('https://weddingchecklistpdf.com/?utm_source=pinterest&utm_content=x', 'Pinterestbot/1.0'), NOW)).toBe(false);
    expect(await recordPinterestVisit(DB, req('https://weddingchecklistpdf.com/?utm_source=pinterest&utm_content=x', UA, 'POST'), NOW)).toBe(false);
    expect(rows(raw)).toEqual([]);
  });

  it('stores no visitor-identifying data', () => {
    const cols = raw.exec('PRAGMA table_info(pinterest_visits)')[0].values.map((c: any[]) => c[1]);
    expect(cols).toEqual(['day', 'utm_content', 'path', 'visits']);
    const v = pinterestVisit(req('https://weddingchecklistpdf.com/a?utm_source=pinterest&utm_content=v1&email=a@b.co'), NOW);
    expect(JSON.stringify(v)).not.toMatch(/203\.0\.113|iPhone|a@b/);
  });

  it('worker.ts routes every tagged request through the log', () => {
    const worker = readFileSync('worker.ts', 'utf8');
    expect(worker).toMatch(/recordPinterestVisit\(env\.DB/);
    expect(worker).toMatch(/return handler\.fetch\(request, env, ctx\)/);
  });
});
