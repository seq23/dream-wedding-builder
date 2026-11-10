import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { recordPinterestVisit, pinterestVisit, LAUNCH_VARIANT, _resetForTests } from '@/lib/pinterest-visits';
import { countWindow } from '@/lib/pinqueue.mjs';

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
    // The app is still what answers; public pages may come from the edge copy (lib/edge-cache.ts),
    // and a tagged request always has a query string, which that cache never serves or stores
    // (tests/unit/edge-cache.test.ts), so every tagged visit reaches the app and is counted.
    expect(worker).toMatch(/handler\.fetch\(request, env, ctx\)/);
  });
});

describe('weekly visit count window', () => {
  // The count covers every whole day since the last count, not a fixed 7 days: the 1 Nov
  // 2026 move to Saturdays left 27-30 Oct outside every week. A named stop is not a count.
  it('covers every day since the last measured count, with no gap and no day twice', () => {
    const legacy = { generated_at: '2026-10-26T17:29:56Z', status: 'MEASURED', window: 'last 7 days (since 2026-10-19)' };
    const stop = { generated_at: '2026-11-01T13:00:00Z', status: 'NAMED_STOP' };
    // 26 Oct was counted only up to 17:29, so it is counted again in full; 27-30 Oct are in.
    expect(countWindow([legacy, stop], '2026-11-07')).toEqual({ from: '2026-10-26', to: '2026-11-06', days: 12 });
    // A count written by this code says where it ended; the next one starts the day after.
    const next = { generated_at: '2026-11-07T13:20:00Z', status: 'MEASURED', window_from: '2026-10-26', window_to: '2026-11-06' };
    expect(countWindow([legacy, next], '2026-11-14')).toEqual({ from: '2026-11-07', to: '2026-11-13', days: 7 });
    // Run again the same day: nothing new to count. No count yet: the last 7 days.
    expect(countWindow([next], '2026-11-07')).toBeNull();
    expect(countWindow([], '2026-11-07')).toEqual({ from: '2026-10-31', to: '2026-11-06', days: 7 });
    // Consecutive counts tile the calendar: each starts the day after the last one ended.
    let history: Array<Record<string, string>> = [legacy];
    let covered: string[] = [];
    for (const today of ['2026-11-07', '2026-11-10', '2026-11-14', '2026-11-28']) {
      const w = countWindow(history, today)!;
      for (let d = w.from; d <= w.to; d = new Date(Date.parse(`${d}T12:00:00Z`) + 86400000).toISOString().slice(0, 10)) covered.push(d);
      history = [...history, { generated_at: `${today}T13:20:00Z`, status: 'MEASURED', window_from: w.from, window_to: w.to }];
    }
    expect(new Set(covered).size).toBe(covered.length);
    expect(covered[0]).toBe('2026-10-26');
    expect(covered.at(-1)).toBe('2026-11-27');
    expect(covered.length).toBe(33);
  });
});
