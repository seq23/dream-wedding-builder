import { describe, expect, it } from 'vitest';
import { buildDatedPlan, undatedPlan } from '@/lib/dated-plan';
import { detailPick, ideaPick, loadJourneyPlan, pickable, venuePick, directionPick, JOURNEY_KEY } from '@/lib/journey-picks';
import { recordReach } from '@/lib/journey-reach';
import { cleanAnswers, fixedRead } from '@/lib/wedding-read';
import { fakeD1 } from '@/tests/support/ai-draft-fakes';

const TODAY = '2026-11-13';
const VENUE = 'Book the venue (it decides the date and the headcount)';
const store = (value: unknown) => ({ getItem: (k: string) => (k === JOURNEY_KEY ? JSON.stringify(value) : null) });

describe('her picks become dated tasks marked as hers', () => {
  const picks = [directionPick({ name: 'Garden layers' }), venuePick({ id: 'public-park-garden', name: 'Park, public garden or pavilion' }), ideaPick({ id: 'dinner-party-layout', name: 'Dinner-Party Reception Layout' }), detailPick('Pillar candles in clear glass down every table.')];

  it('each pick lands in its window with her date, and is listed as a pick', () => {
    const plan = buildDatedPlan('2027-12-11', TODAY, { picks, venueBooked: false });
    const window = (id: string) => plan.windows.find(w => w.id === id)!.tasks;
    expect(window('12-plus')).toContain('Brief every vendor on the direction: Garden layers');
    expect(window('12-plus')).toContain('Tour venues of this type: park, public garden or pavilion');
    expect(window('6-months')).toContain('Plan this idea with the vendor it needs: Dinner-Party Reception Layout');
    expect(window('6-months')).toContain('Plan the lighting: pillar candles in clear glass down every table');
    expect(plan.picks).toHaveLength(4);
    expect(window('12-plus')).toContain(VENUE);
  });

  it('a booked venue removes the venue task, dated or not; without picks the plan is unchanged', () => {
    const booked = buildDatedPlan('2027-12-11', TODAY, { picks, venueBooked: true });
    expect(booked.windows.flatMap(w => w.tasks)).not.toContain(VENUE);
    expect(undatedPlan({ picks: [], venueBooked: true }).flatMap(w => w.tasks)).not.toContain(VENUE);
    expect(buildDatedPlan('2027-12-11', TODAY)).toEqual({ ...buildDatedPlan('2027-12-11', TODAY, { picks: [], venueBooked: false }) });
    expect(buildDatedPlan('2027-12-11', TODAY).windows.flatMap(w => w.tasks)).toContain(VENUE);
  });

  it('a pick whose window has passed is still on the plan, under catch-up', () => {
    const late = buildDatedPlan('2027-04-01', TODAY, { picks, venueBooked: false });
    expect([...late.catchUp, ...late.windows.flatMap(w => w.tasks)]).toEqual(expect.arrayContaining(picks.map(p => p.text)));
  });

  it('step 3 offers no venue types when the venue is booked', () => {
    const read = fixedRead(cleanAnswers({ path: 'dk', setting: 'Outdoors', moods: ['Garden'] }));
    expect(pickable(read, false).venues.length).toBeGreaterThan(0);
    expect(pickable(read, true).venues).toEqual([]);
  });

  it('picks are read back from this browser for the planner, the dashboard and the printable page; junk is dropped', () => {
    expect(loadJourneyPlan(store({ picks, facts: { venueBooked: true } }))).toEqual({ picks, venueBooked: true });
    expect(loadJourneyPlan(store({ picks: [{ text: 'x', windowId: 'nonsense', key: 'k' }, 'junk', null] }))).toEqual({ picks: [], venueBooked: false });
    expect(loadJourneyPlan({ getItem: () => '{not json' })).toEqual({ picks: [], venueBooked: false });
    expect(loadJourneyPlan(undefined)).toEqual({ picks: [], venueBooked: false });
  });
});

describe('the scorecard count: a bride who began at step 1 reached her plan', () => {
  it('counts once per visitor per day, flags our own checks, and stores no words', async () => {
    const { db, sqlite } = fakeD1();
    const base = { db, ip: '1.1.1.1', today: TODAY, salt: 's', isTest: false, log: () => {} };
    expect(await recordReach({ ...base, via: 'date' })).toBe('recorded');
    expect(await recordReach({ ...base, via: 'no_date' })).toBe('already');
    expect(await recordReach({ ...base, via: 'date', today: '2026-11-14' })).toBe('recorded');
    expect(await recordReach({ ...base, via: 'date', ip: '2.2.2.2', isTest: true })).toBe('recorded');
    expect(await recordReach({ ...base, via: 'anything', ip: '3.3.3.3' })).toBe('skipped');
    const rows = sqlite.prepare('SELECT ip_hash, day, via, is_test FROM journey_plan_reach').all() as Record<string, unknown>[];
    expect(rows).toHaveLength(3);
    expect(JSON.stringify(rows)).not.toContain('1.1.1.1');
    const n = sqlite.prepare("SELECT COUNT(*) AS n FROM journey_plan_reach WHERE is_test = 0 AND created_at >= datetime('2026-01-01T00:00:00Z')").get() as { n: number };
    expect(n.n).toBe(2);
    expect(await recordReach({ ...base, via: 'date', db: undefined })).toBe('skipped');
  });
});
