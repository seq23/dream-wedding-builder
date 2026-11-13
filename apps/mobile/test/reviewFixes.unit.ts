// Behaviour behind the 13 Nov 2026 review fixes: nothing is saved that she did not choose,
// her details change what her plan shows, a new plan has no locked task dated in the past,
// and the paid part always carries its name and (when known) its price.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_WINDOWS, addDays, isoDay, parseDay } from '@core/dated-plan';
import { taskKey } from '@core/plan-progress';
import { dateStore } from '../src/weddingDate';
import { canSaveDate, startingDate } from '../src/welcomeStart';
import { lockedPlanRows } from '../src/planTasks';
import { planNotes } from '../src/planDetails';
import { detailLabels } from '../src/draftReview';
import { fullPlanPrice, partOfFullPlan } from '../src/build';

const memory = () => { const values = new Map<string, string>(); return { values, getItem: async (k: string) => values.get(k) ?? null, setItem: async (k: string, v: string) => { values.set(k, v); } }; };

test('a new phone opens with no date in the field, the main button cannot save one, and nothing is stored until she chooses', async () => {
  const storage = memory();
  const saved = await dateStore(storage).read();
  assert.equal(saved, null);
  const shown = startingDate(saved);
  assert.equal(shown, '');
  assert.equal(canSaveDate(shown), false);
  assert.equal(storage.values.size, 0, 'opening the first screen writes nothing');
  await dateStore(storage).save('2027-11-13', '2026-11-13');
  assert.equal(startingDate(await dateStore(storage).read()), '2027-11-13', 'coming back to change it shows her own date');
  assert.equal(canSaveDate('2027-02-30'), false);
});

test('a brand-new plan never shows a locked task dated before the day she began', () => {
  const today = '2026-11-13';
  for (const months of [1, 3, 8, 12, 13, 30]) {
    const wedding = isoDay(addDays(parseDay(today)!, months * 30));
    for (const w of PLAN_WINDOWS) for (const row of lockedPlanRows(wedding, w.id, today)) {
      if (row.dueOn) assert.ok(row.dueOn >= today, `${wedding} ${w.id}: ${row.dueOn}`);
      else assert.equal(row.startHere, true);
    }
  }
  // One year out, the 390-days-before task would have been 19 Oct 2026: it is "Start here", undated.
  assert.equal(lockedPlanRows('2027-11-13', '12-plus', today)[0].dueOn, null);
  // A task that falls due after she began keeps its date, even once that date has passed.
  assert.equal(lockedPlanRows('2027-11-13', '12-plus', '2026-10-01')[0].dueOn, '2026-10-19');
});

test('guests, place and budget change what her tasks say; no details, no notes', () => {
  assert.deepEqual(planNotes({}), {});
  const venue = taskKey('12-plus', 'Book the venue (it decides the date and the headcount)');
  const notes = planNotes({ guestCount: '100', locations: 'Memphis', budgetTarget: '$30,000' });
  assert.match(notes[venue], /100 guests/);
  assert.match(notes[venue], /Memphis/);
  assert.match(notes[venue], /\$\d/);
  const bigger = planNotes({ guestCount: '100', locations: 'Memphis', budgetTarget: '$60,000' });
  assert.notEqual(bigger[venue], notes[venue], 'a different budget is a different share');
  assert.notEqual(planNotes({ guestCount: '40' })[venue], planNotes({ guestCount: '100' })[venue]);
  // Place alone decides the travel note, by the website's own destination rule.
  const saveTheDates = taskKey('9-months', 'Send save-the-dates (8 months or more ahead for travel weddings)');
  assert.equal(planNotes({ locations: 'Memphis' })[saveTheDates], undefined);
  assert.match(planNotes({ locations: 'Tuscany, Italy' })[saveTheDates], /8 months/);
  // What matters most moves money toward it.
  const photos = taskKey('9-months', 'Book the photographer and the caterer');
  assert.notEqual(planNotes({ budgetTarget: '30000', priorities: 'the photos' })[photos], planNotes({ budgetTarget: '30000' })[photos]);
  // Every note sits on a real task row.
  const keys = new Set(PLAN_WINDOWS.flatMap(w => w.tasks.map(t => taskKey(w.id, t))));
  const all = planNotes({ guestCount: '100', locations: 'Tuscany, Italy', budgetTarget: '30000', priorities: 'music' });
  assert.ok(Object.keys(all).length >= 10);
  for (const key of Object.keys(all)) assert.ok(keys.has(key), key);
});

test('every detail the app keeps is one the plan reads', () => {
  const read: Record<string, string> = { weddingDate: '2027-11-13', guestCount: '100', locations: 'Tuscany', budgetTarget: '30000', budgetMode: 'hard', priorities: 'photos' };
  assert.deepEqual(Object.keys(detailLabels).sort(), Object.keys(read).sort());
  const base = { guestCount: '100', locations: 'Tuscany', budgetTarget: '30000' };
  for (const key of ['guestCount', 'locations', 'budgetTarget', 'budgetMode', 'priorities'] as const) {
    const without = { ...base, budgetMode: 'hard', priorities: 'photos', [key]: '' };
    assert.notDeepEqual(planNotes(without), planNotes({ ...base, budgetMode: 'hard', priorities: 'photos' }), `${key} changes nothing`);
  }
});

test('the paid part is named with a price only when one is known: the store price, or the list price in the preview', () => {
  assert.equal(fullPlanPrice('US$9.99', false), 'US$9.99');
  assert.equal(fullPlanPrice('US$9.99', true), 'US$9.99');
  assert.equal(fullPlanPrice(undefined, true), '$14.99');
  assert.equal(fullPlanPrice(undefined, false), '', 'a store build never shows a guessed price');
  assert.match(partOfFullPlan('$14.99'), /full plan.*\$14\.99/);
  assert.doesNotMatch(partOfFullPlan(''), /\$/);
});
