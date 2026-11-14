// The 14 Nov 2026 first-time-user test on the iOS simulator: one behaviour check per finding
// that has behaviour off the screen (budget, paywall name, plan windows, PDF name, quota).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_WINDOWS, buildDatedPlan, plainDate } from '@core/dated-plan';
import { parseProgress, taskKey } from '@core/plan-progress';
import { journeyDetails, typedBudget } from '../src/draftReview';
import { budgetBand, planNotes } from '../src/planDetails';
import { defaultEventName } from '../src/billing/eventName';
import { packetFileName, sharePacket } from '../src/packet';
import { taskRows, whenLine } from '../src/planTasks';
import { quotaNote } from '../src/journey';
import { emptyProgress } from '@core/plan-progress';

const budgetTask = taskKey('12-plus', 'Agree the total budget and who is contributing');
const venueTask = taskKey('12-plus', 'Book the venue (it decides the date and the headcount)');

test('finding 3: a budget she typed wins over the band she tapped; a band alone shows as the band, never its top', () => {
  assert.equal(typedBudget('garden dinner, budget around 40000'), '40000');
  assert.equal(typedBudget('about $40k all in'), '40000');
  assert.equal(typedBudget('40,000 budget, outdoors'), '40000');
  assert.equal(typedBudget('100 people in a garden'), '');
  const answers = { guests: '120', where: 'Napa, CA', budget: '$25,000 to $50,000', wish: 'sage and gold, budget around 40000', path: 'idea' };
  const typed = journeyDetails({}, answers);
  assert.equal(typed.budgetTarget, '40000');
  // A band saved earlier is replaced by her typed number; a number she typed on the details screen is not.
  assert.equal(journeyDetails({ budgetTarget: '$25,000 to $50,000' }, answers).budgetTarget, '40000');
  assert.equal(journeyDetails({ budgetTarget: '35000' }, answers).budgetTarget, '35000');
  assert.match(planNotes(typed)[budgetTask], /Your budget: \$40,000, about \$333 a guest for 120 guests\./);

  const bandOnly = journeyDetails({}, { ...answers, wish: 'sage and gold' });
  assert.equal(bandOnly.budgetTarget, '$25,000 to $50,000');
  const notes = planNotes(bandOnly);
  assert.match(notes[budgetTask], /Your budget: \$25,000 to \$50,000, about \$208 to \$417 a guest for 120 guests\./);
  assert.doesNotMatch(notes[budgetTask], /Your budget: \$50,000/);
  assert.match(notes[venueTask], /about \$\d[\d,]* to \$\d[\d,]* for venue, food and drink/);
  assert.deepEqual(budgetBand('Under $10,000'), { low: 0, high: 10000 });
  assert.deepEqual(budgetBand('Over $50,000'), { low: 50000, high: null });
  assert.equal(budgetBand('40000'), null);
  assert.match(planNotes({ budgetTarget: 'Under $10,000' })[budgetTask], /up to \$10,000/);
  assert.match(planNotes({ budgetTarget: 'Over $50,000' })[budgetTask], /\$50,000 or more/);
  // The "I don't know yet" path never reads a budget out of old typed words.
  assert.equal(journeyDetails({}, { ...answers, path: 'dk' }).budgetTarget, '$25,000 to $50,000');
});

test('finding 6: buying never waits on a name; an empty name becomes a sensible default she can change', () => {
  assert.equal(defaultEventName('2027-11-06'), 'Our wedding – Nov 6, 2027');
  assert.equal(defaultEventName(null), 'Our wedding');
  assert.equal(defaultEventName('not a date'), 'Our wedding');
});

test('finding 7: the windows are contiguous, named like the binder tabs, and a passed window says "Do now", never a past date', () => {
  for (let i = 1; i < PLAN_WINDOWS.length; i++) assert.equal(PLAN_WINDOWS[i].fromMonths, PLAN_WINDOWS[i - 1].toMonths, `${PLAN_WINDOWS[i].id} starts where ${PLAN_WINDOWS[i - 1].id} ends`);
  assert.deepEqual(PLAN_WINDOWS.map(w => w.label), ['12+ months before', '9 months before', '6 months before', '3 months before', '1 month before', 'Wedding week']);
  for (const w of PLAN_WINDOWS.slice(1, -1)) assert.equal(w.label, `${w.fromMonths} month${w.fromMonths === 1 ? '' : 's'} before`, 'each label names where its window starts');

  // The tester's wedding: Sat Nov 6, 2027, seen on Sat Nov 14, 2026.
  const plan = buildDatedPlan('2027-11-06', '2026-11-14');
  const rows = taskRows(emptyProgress());
  const first = rows.find(r => r.windowId === '12-plus')!, later = rows.find(r => r.windowId === '9-months')!;
  assert.equal(whenLine(first, '12+ months before', plan, false), '12+ months before · do now, by Fri, Feb 5, 2027');
  assert.equal(whenLine(later, '9 months before', plan, false), '9 months before · starts Sat, Feb 6, 2027');

  // Four months out: the 12+ and 9-month windows have passed; their tasks say "Do now" with no date.
  const late = buildDatedPlan('2027-03-14', '2026-11-14');
  assert.ok(!late.windows.some(w => w.id === '12-plus'));
  const line = whenLine(first, '12+ months before', late, true);
  assert.equal(line, 'Do now · usually 12+ months before');
  assert.doesNotMatch(line, /20\d\d/);
  // No date set: the tab alone.
  assert.equal(whenLine(first, '12+ months before', buildDatedPlan('', '2026-11-14'), false), '12+ months before');
});

test('finding 8: dates are US style, and a tick on a respelled task is kept', () => {
  assert.equal(plainDate('2027-11-06'), 'Sat, Nov 6, 2027');
  assert.equal(buildDatedPlan('2027-11-06', '2026-11-14').headline, 'Your wedding: Sat, Nov 6, 2027 · about 12 months away.');
  const oldKey = taskKey('wedding-week', 'Put final payments and tips in labelled envelopes');
  const progress = parseProgress(JSON.stringify({ done: { [oldKey]: '2026-11-01T10:00:00Z' }, custom: [] }));
  assert.equal(progress.done[taskKey('wedding-week', 'Put final payments and tips in labeled envelopes')], '2026-11-01T10:00:00Z');
});

test('finding 5: the PDF is shared as "Wedding plan – <names or date>.pdf", never the print engine\'s id', async () => {
  assert.equal(packetFileName({ names: 'Sam & Alex', date: '2027-11-06' }), 'Wedding plan – Sam & Alex.pdf');
  assert.equal(packetFileName({ names: '  ', date: '2027-11-06' }), 'Wedding plan – Nov 6, 2027.pdf');
  assert.equal(packetFileName({ names: 'A/B: "us"', date: '' }), 'Wedding plan – A B us.pdf');
  assert.equal(packetFileName({ names: '', date: '' }), 'Wedding plan.pdf');
  let shared = '';
  const input = { names: 'Sam & Alex', date: '2027-11-06', progress: emptyProgress(), unlocked: false, list: null, payments: { own: [], edits: {} }, week: { who: {}, contacts: [] } } as unknown as Parameters<typeof sharePacket>[0];
  await sharePacket(input, 'Letter', { print: async () => ({ uri: 'file:///cache/Print/8F2C-UUID.pdf' }), rename: (_uri, name) => `file:///cache/${name}`, share: async uri => { shared = uri; } });
  assert.equal(shared, 'file:///cache/Wedding plan – Sam & Alex.pdf');
});

test('finding 9: the daily allowance is not shown until she is about to run out, then in plain words', () => {
  assert.equal(quotaNote(284), null);
  assert.equal(quotaNote(2), null);
  assert.equal(quotaNote(null), null);
  assert.match(quotaNote(1)!, /once more today/);
  assert.match(quotaNote(0)!, /without AI/);
  assert.doesNotMatch(quotaNote(0)! + quotaNote(1)!, /\d/);
});
