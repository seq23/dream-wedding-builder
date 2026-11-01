import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM script without types
import { buildSummary, pagesLine, pinterestLine, salesLine, searchLine, selfCheck } from '../../scripts/spry/spry-weekly-summary.mjs';

const now = Date.parse('2026-11-04T13:00:00Z');
const host = (clicks: number, impressions: number, collected = '2026-11-03T11:45:00Z') => ({ complete: true, collected_at: collected, period: { end: '2026-11-01' }, totals: { clicks, impressions } });

describe('Spry Labs weekly hand-off (Dream Wedding)', () => {
  it('passes its own self-check', () => expect(() => selfCheck()).not.toThrow());

  it('writes the shape Boss OS reads', () => {
    const s = buildSummary({ now, sales: { paid: 0 }, gsc: { hosts: { 'a.example': host(0, 3) } }, pin: { status: 'MEASURED', generated_at: '2026-10-31T11:00:00Z', total: 0 }, pages: { guidesNow: 5, guidesBefore: 5, refresh: { runs: [] } } });
    expect(s.schema).toBe('spry-weekly-summary-v1');
    expect(Date.parse(s.generated_at)).toBe(now);
    expect(s.sites).toEqual([{ host: 'a.example', label: 'a.example', state: 'fine', why: [] }]);
    expect(s.notes).toHaveLength(4);
  });

  it('never turns an unread number into a zero (rule 0)', () => {
    expect(salesLine({ error: 'the Cloudflare credentials are not set for this run' }).line).toBe('Sales: not read: the Cloudflare credentials are not set for this run.');
    expect(searchLine({ hosts: { 'a.example': host(4, 9, '2026-10-01T00:00:00Z') } }, now).line).toMatch(/^Search: not read: /);
    expect(pinterestLine({ status: 'NAMED_STOP', reason: 'D1 unreadable.' }, now).line).toBe('Pinterest: not read: D1 unreadable.');
    expect(pinterestLine({ status: 'MEASURED', generated_at: '2026-10-10T00:00:00Z', total: 0 }, now).line).toMatch(/^Pinterest: not read: the newest measurement is from Oct/);
    expect(pagesLine({}, now).line).toMatch(/^Pages: not read: /);
  });

  it('refuses to hand on a week where nothing was read', () => {
    expect(() => buildSummary({ now, sales: { error: 'x' }, gsc: null, pin: null, pages: {} })).toThrow(/NAMED STOP \[NOTHING_READ\]/);
  });

  it('is scheduled on Wednesday in Central time and uploads the artifact Boss OS reads', () => {
    const wf = readFileSync('.github/workflows/spry-weekly-summary.yml', 'utf8');
    expect(wf).toMatch(/- cron: '53 7 \* \* 3'.*\n\s+timezone: America\/Chicago/);
    expect(wf).toMatch(/spry-weekly-summary\.mjs --self-check/);
    expect(wf).toMatch(/name: spry-weekly-summary\n/);
    expect(wf).toMatch(/if-no-files-found: error/);
    expect(readFileSync('docs/SCHEDULE.md', 'utf8')).toContain('| Spry Labs weekly summary | `spry-weekly-summary.yml` | Wed 07:53 CT | `53 7 * * 3` |');
  });
});
