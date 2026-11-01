import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import initSqlJs from 'sql.js';
import { NextRequest } from 'next/server';
import { cleanPinRef, PIN_COOKIE, pinRefFromUrl, recordPinterestConversion, signupRef } from '@/lib/pinterest-conversions';
import { middleware } from '@/middleware';

// Pin visit -> sale / signup: the real insert against SQLite with the real migration,
// and the middleware that remembers the pin. A sale is counted once per order, a
// signup once per address, and no row holds an email.

const SQL = await initSqlJs();
function d1(db: any) {
  const make = (sql: string, args: any[] = []) => ({ bind: (...a: any[]) => make(sql, a), run: async () => { db.run(sql, args); return {}; } });
  return { prepare: (sql: string) => make(sql) };
}
const fresh = () => { const raw = new SQL.Database(); raw.run(readFileSync('migrations/0004_pinterest_conversions.sql', 'utf8')); return { raw, DB: d1(raw) }; };
const all = (raw: any) => { const r = raw.exec('SELECT day, utm_content, kind, ref FROM pinterest_conversions ORDER BY kind, ref'); return r.length ? r[0].values : []; };
const NOW = new Date('2026-11-04T15:00:00Z');

describe('pinterest conversions', () => {
  it('records a sale once per order and a signup once per address, with no email stored', async () => {
    const { raw, DB } = fresh();
    expect(await recordPinterestConversion(DB, { kind: 'sale', pinRef: 'guides-wedding-week-checklist-01', ref: 'order-1', now: NOW })).toBe(true);
    await recordPinterestConversion(DB, { kind: 'sale', pinRef: 'guides-wedding-week-checklist-01', ref: 'order-1', now: NOW }); // webhook retry
    const ref = await signupRef('a@example.com');
    await recordPinterestConversion(DB, { kind: 'signup', pinRef: 'q-how-far-in-advance', ref, now: NOW });
    await recordPinterestConversion(DB, { kind: 'signup', pinRef: 'q-how-far-in-advance', ref: await signupRef('a@example.com'), now: NOW });
    expect(all(raw)).toEqual([['2026-11-04', 'guides-wedding-week-checklist-01', 'sale', 'order-1'], ['2026-11-04', 'q-how-far-in-advance', 'signup', ref]]);
    expect(JSON.stringify(all(raw))).not.toContain('example.com');
  });

  it('records nothing for a buyer who did not come from a pin, and never throws into a sale', async () => {
    const { raw, DB } = fresh();
    expect(await recordPinterestConversion(DB, { kind: 'sale', pinRef: undefined, ref: 'order-2' })).toBe(false);
    expect(await recordPinterestConversion(DB, { kind: 'sale', pinRef: '"><script>', ref: 'order-3' })).toBe(true);
    expect(all(raw).map((r: any[]) => r[1])).toEqual(['script']);
    const broken = { prepare: () => ({ bind: () => ({ run: async () => { throw new Error('D1 down'); } }) }) };
    expect(await recordPinterestConversion(broken, { kind: 'sale', pinRef: 'x', ref: 'order-4' })).toBe(false);
  });

  it('only a pinterest-tagged URL names a pin', () => {
    expect(pinRefFromUrl(new URL('https://weddingchecklistpdf.com/a?utm_source=pinterest&utm_content=v-01'))).toBe('v-01');
    expect(pinRefFromUrl(new URL('https://weddingchecklistpdf.com/a?utm_source=pinterest'))).toBe('launch');
    expect(pinRefFromUrl(new URL('https://weddingchecklistpdf.com/a?utm_source=google&utm_content=v-01'))).toBeNull();
    expect(cleanPinRef('')).toBeNull();
  });

  it('the middleware sets the pin cookie on a pin visit and on nothing else', () => {
    const at = (url: string) => middleware(new NextRequest(url, { headers: { host: 'weddingchecklistpdf.com', 'cf-visitor': '{"scheme":"https"}' } }));
    const hit = at('https://weddingchecklistpdf.com/guides/wedding-week-checklist?utm_source=pinterest&utm_medium=organic&utm_campaign=pinfeed&utm_content=guides-wedding-week-checklist-01');
    const cookie = hit.cookies.get(PIN_COOKIE);
    expect(cookie?.value).toBe('guides-wedding-week-checklist-01');
    expect(cookie?.maxAge).toBe(30 * 86400);
    expect(at('https://weddingchecklistpdf.com/guides/wedding-week-checklist').cookies.get(PIN_COOKIE)).toBeUndefined();
  });
});
