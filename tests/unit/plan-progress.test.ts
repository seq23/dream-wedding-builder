import { describe, expect, it } from 'vitest';
import { addCustomTask, parseProgress, removeCustomTask, taskKey, toggleDone, emptyProgress } from '@/lib/plan-progress';
import { buildIcs, icsText } from '@/lib/plan-ics';
import { buildDatedPlan } from '@/lib/dated-plan';

describe('dated plan progress (no account)', () => {
  it('ticks toggle and survive a round trip; a corrupt blob is an empty start', () => {
    let p = toggleDone(emptyProgress(), taskKey('1-month', 'Pay the balances that fall due'), '2026-11-06T10:00:00Z');
    p = parseProgress(JSON.stringify(p));
    expect(Object.keys(p.done)).toEqual(['1-month::Pay the balances that fall due']);
    expect(toggleDone(p, '1-month::Pay the balances that fall due', 'x').done).toEqual({});
    expect(parseProgress('{bad')).toEqual(emptyProgress());
    expect(parseProgress(JSON.stringify({ done: { a: 1 }, custom: [{ id: 1 }] }))).toEqual(emptyProgress());
  });

  it('own tasks are trimmed, capped, and removing one clears its tick', () => {
    let p = addCustomTask(emptyProgress(), '6-months', '   Book the   church  ', 'c1');
    expect(p.custom).toEqual([{ id: 'c1', windowId: '6-months', text: 'Book the church' }]);
    expect(addCustomTask(p, '6-months', '   ', 'c2')).toBe(p);
    expect(addCustomTask(p, '6-months', 'x'.repeat(500), 'c3').custom[1].text).toHaveLength(140);
    p = toggleDone(p, taskKey('6-months', 'Book the church'), 't');
    expect(removeCustomTask(p, 'c1')).toEqual(emptyProgress());
  });
});

describe('calendar reminders', () => {
  it('one all-day reminder per window still ahead with its open tasks, plus the wedding day; ticked tasks are left out', () => {
    const plan = buildDatedPlan('2027-09-18', '2026-11-06');
    const ics = buildIcs(plan, '2027-09-18', (id, tasks) => tasks.filter(t => !(id === 'wedding-week' && t.startsWith('Pack'))), '20261106T100000Z')!;
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(plan.windows.length + 1);
    expect(ics).toContain('DTSTART;VALUE=DATE:20270918');
    expect(ics).toContain('DTEND;VALUE=DATE:20270919');
    expect(ics).toContain(`DTSTART;VALUE=DATE:${plan.windows.find(w => w.id === 'wedding-week')!.startsOn.replace(/-/g, '')}`);
    expect(ics).not.toContain('Pack for the night');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('no reminders for a past or missing date', () => {
    expect(buildIcs(buildDatedPlan('2020-01-01', '2026-11-06'), '2020-01-01', (_i, t) => t, 's')).toBeNull();
    expect(buildIcs(buildDatedPlan('', '2026-11-06'), '', (_i, t) => t, 's')).toBeNull();
  });

  it('escapes calendar text', () => {
    expect(icsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });
});
