import { describe, expect, it } from 'vitest';
import { buildDatedPlan, localToday, monthsBefore, parseDay, plainDate } from '@/lib/dated-plan';

const TODAY = '2026-11-06';

describe('dated plan (the date the couple enters becomes real calendar dates)', () => {
  it('no date: asks for one, draws no windows', () => {
    const plan = buildDatedPlan('', TODAY);
    expect(plan.state).toBe('none');
    expect(plan.windows).toHaveLength(0);
  });

  it('29 Feb only exists in leap years', () => {
    expect(parseDay('2028-02-29')).toEqual({ y: 2028, m: 2, d: 29 });
    expect(parseDay('2027-02-29')).toBeNull();
    expect(buildDatedPlan('2027-02-29', TODAY).state).toBe('invalid');
    expect(parseDay('2026-13-01')).toBeNull();
    expect(parseDay('06/12/2027')).toBeNull();
  });

  it('29 Feb 2028 minus 12 months clamps to 28 Feb 2027, never rolls into March', () => {
    expect(monthsBefore({ y: 2028, m: 2, d: 29 }, 12)).toEqual({ y: 2027, m: 2, d: 28 });
    expect(monthsBefore({ y: 2027, m: 3, d: 31 }, 1)).toEqual({ y: 2027, m: 2, d: 28 });
    const plan = buildDatedPlan('2028-02-29', TODAY);
    expect(plan.state).toBe('future');
    expect(plan.windows.find(w => w.id === '9-months')?.startsOn).toBe('2027-05-29');
    expect(plan.windows.at(-1)?.endsOn).toBe('2028-02-29');
  });

  it('a past date is said plainly and draws no plan', () => {
    const plan = buildDatedPlan('2026-10-01', TODAY);
    expect(plan.state).toBe('past');
    expect(plan.headline).toContain('already passed');
    expect(plan.windows).toHaveLength(0);
  });

  it('today is the wedding day, not a negative countdown', () => {
    expect(buildDatedPlan(TODAY, TODAY).state).toBe('today');
  });

  it('three weeks out: earlier windows fold into catch-up, the current window starts today, nothing dated before today', () => {
    const plan = buildDatedPlan('2026-11-27', TODAY);
    expect(plan.daysToGo).toBe(21);
    expect(plan.catchUp).toContain('Book the venue (it decides the date and the headcount)');
    expect(plan.windows.map(w => w.id)).toEqual(['1-month', 'wedding-week']);
    expect(plan.windows[0]).toMatchObject({ startsOn: TODAY, timing: 'now', endsOn: '2026-11-19' });
    expect(plan.windows[1]).toMatchObject({ startsOn: '2026-11-20', endsOn: '2026-11-27', timing: 'later' });
    for (const w of plan.windows) expect(w.startsOn >= TODAY).toBe(true);
  });

  it('two years out: every window is in the future except the first, with no catch-up', () => {
    const plan = buildDatedPlan('2028-11-04', TODAY);
    expect(plan.catchUp).toEqual([]);
    expect(plan.windows).toHaveLength(6);
    expect(plan.windows[0]).toMatchObject({ id: '12-plus', startsOn: TODAY, endsOn: '2028-02-03', timing: 'now' });
    expect(plan.windows.slice(1).every(w => w.timing === 'later')).toBe(true);
    expect(plan.warning).toBeNull();
  });

  it('windows are contiguous: each starts the day after the last ends', () => {
    const plan = buildDatedPlan('2027-09-18', TODAY);
    for (let i = 1; i < plan.windows.length; i++) {
      const prev = new Date(plan.windows[i - 1].endsOn + 'T00:00:00Z').getTime();
      const next = new Date(plan.windows[i].startsOn + 'T00:00:00Z').getTime();
      expect(next - prev).toBe(86_400_000);
    }
  });

  it('a date 5 years out gets a check-the-year warning', () => {
    expect(buildDatedPlan('2031-06-01', TODAY).warning).toContain('more than 3 years');
  });

  it('today comes from the local clock, not UTC (11pm in Memphis stays the same day)', () => {
    expect(localToday(new Date(2026, 10, 6, 23, 30))).toBe('2026-11-06');
  });

  it('plain dates name the weekday', () => {
    expect(plainDate('2028-02-29')).toBe('Tue 29 Feb 2028');
  });
});
