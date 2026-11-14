// The 14 Nov 2026 user-point-of-view review of the app (20 findings): one behaviour check per
// finding that has behaviour on the phone. Findings 1, 2, 4, 5, 10 and 14 are proven next to
// their code (offers, billing, weddingDate, aiDraft, journey, eventName tests).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress } from '@core/plan-progress';
import { buildDatedPlan, placePicks } from '@core/dated-plan';
import { LOVES, TRADITIONS, toggleTradition, traditionList } from '@core/wedding-read-shared';
import { directionPick, ideaPick, venuePick } from '@core/journey-picks';
import { EMPTY_ANSWERS, answersToSend, applyTradition, pickable, type WeddingRead } from '../src/journey';
import { markAllDone, planBlocks, startHereView, taskRows, weddingDayRows, windowRows } from '../src/planTasks';
import { onboardingLeft } from '../src/screens';
import { paymentRows } from '../src/payments';
import { withWho } from '../src/weddingWeek';
import { clearNeedsConfirm, dateCheck } from '../src/welcomeStart';
import { hasTraditionPack } from '../src/traditionPacks';

const read = (over: Partial<WeddingRead> = {}): WeddingRead => ({ by: 'ai', headline: 'h', read: 'r', directions: [], colours: [], venueTypes: [], ideas: [], details: [], ask: [], honest: '', photoNotes: [], ...over });

test('finding 3: with a date the season comes from it, and the date counts as set', () => {
  const a = { ...EMPTY_ANSWERS, season: 'Summer' };
  assert.deepEqual([answersToSend(a, '2026-12-05').season, answersToSend(a, '2026-12-05').dateSet], ['Winter', true]);
  assert.deepEqual([answersToSend(a, '').season, answersToSend(a, '').dateSet], ['Summer', false]);
});

test('finding 6: a late start opens short, and several done tasks tick at once', () => {
  const rows = Array.from({ length: 18 }, (_, i) => ({ key: `k${i}` }));
  assert.deepEqual([startHereView(rows, false).shown.length, startHereView(rows, false).hidden], [5, 13]);
  assert.equal(startHereView(rows, true).shown.length, 18);
  const done = markAllDone({ ...emptyProgress(), done: { k1: 'earlier' } }, ['k1', 'k2', 'k3'], 'now');
  assert.deepEqual(done.done, { k1: 'earlier', k2: 'now', k3: 'now' });
});

test('finding 7: a task in a block above is not listed again in its window', () => {
  const rows = taskRows(emptyProgress());
  const late = rows.filter(r => r.windowId === '12-plus');
  const blocks = planBlocks(rows, late);
  const all = [...blocks.startHere, ...blocks.catchUp, ...blocks.next, ...['12-plus', '9-months', '6-months', '3-months', '1-month', 'wedding-week'].flatMap(w => windowRows(rows, blocks, w))];
  assert.equal(all.length, rows.length);
  assert.equal(new Set(all.map(r => r.key)).size, rows.length);
});

test('finding 8: the same idea is offered once across directions, ideas and details', () => {
  const groups = pickable(read({ directions: [{ name: 'Fruit and floral tablescape', what: 'x' }], ideas: [{ id: 'fruit', name: 'Fruit-and-Floral Tablescape', cost: '$', why: 'y' }, { id: 'aisle', name: 'Living garden aisle', cost: '$', why: 'z' }], details: ['Living garden aisle.', 'Candles on every table'] }), false);
  assert.deepEqual(groups.directions.map(d => d.label), ['Fruit and floral tablescape']);
  assert.deepEqual(groups.ideas.map(i => i.label), ['Living garden aisle']);
  assert.deepEqual(groups.details.map(d => d.sub), ['Candles on every table']);
});

test('finding 9: picks are dated from now when their window has closed, and no venue tours 3 weeks out', () => {
  const picks = [directionPick({ name: 'Garden party' }), venuePick({ id: 'park', name: 'Park' }), ideaPick({ id: 'i', name: 'Idea' })];
  const late = placePicks(picks, '2026-12-05', '2026-11-14');
  assert.equal(late.some(p => p.key.startsWith('venue:')), false);
  assert.ok(late.every(p => p.windowId === '1-month'), JSON.stringify(late));
  assert.deepEqual(placePicks(picks, '2028-06-01', '2026-11-14'), picks);
  const plan = buildDatedPlan('2026-12-05', '2026-11-14', { picks: late, venueBooked: false });
  assert.ok(plan.windows.find(w => w.id === '1-month')!.tasks.includes(late[0].text));
});

test('finding 11: the journey shows Back whenever there is a screen under it', () => {
  assert.equal(onboardingLeft(false, true), 'back');
  assert.equal(onboardingLeft(false, false), 'logo');
  assert.equal(onboardingLeft(true, false), 'parent');
});

test('finding 15: a plan payment keeps the due date she set, and still follows the wedding until she does', () => {
  const list = { windows: [{ id: 'w', label: 'W' }], tasks: [{ id: 'dep', window: 'w', text: 'Deposit', owner: 'Caterer', kind: 'payment' as const, daysBefore: 30 }] };
  const base = paymentRows(list, '2027-06-12', [], {}, true)[0];
  assert.equal(paymentRows(list, '2027-06-12', [], { [base.id]: { ...base, cents: 5000 } }, true)[0].date, base.date);
  assert.equal(paymentRows(list, '2027-06-12', [], { [base.id]: { ...base, date: '2027-04-02', ownDate: true } }, true)[0].date, '2027-04-02');
});

test('finding 16 and 2: clearing a saved date and saving a past date both ask first', () => {
  assert.equal(clearNeedsConfirm('2027-06-12'), true);
  assert.equal(clearNeedsConfirm(null), false);
  assert.equal(clearNeedsConfirm(''), false);
  assert.equal(dateCheck('2025-12-05', '2026-11-14'), 'past');
  assert.equal(dateCheck('2027-12-05', '2026-11-14'), 'ok');
});

test('finding 17: the wedding day shows the day’s tasks; afterwards it is congratulations', () => {
  const day = buildDatedPlan('2026-11-14', '2026-11-14');
  assert.equal(day.state, 'today');
  assert.deepEqual(day.windows.map(w => w.id), ['wedding-week']);
  assert.ok(day.windows[0].tasks.length > 0);
  assert.deepEqual(day.catchUp, []);
  const rows = taskRows(emptyProgress());
  assert.ok(weddingDayRows(rows, '2026-11-14').length > 0);
  assert.ok(weddingDayRows(rows, '2026-11-14').every(r => r.windowId === 'wedding-week'));
  const after = buildDatedPlan('2026-11-07', '2026-11-14');
  assert.equal(after.state, 'past');
  assert.match(after.headline, /^Congratulations/);
  assert.doesNotMatch(after.headline, /has already passed/);
});

test('finding 18: every name typed on the week sheet is kept together, an emptied box clears', () => {
  const next = withWho({ who: { a: 'Old', b: 'Keep' }, contacts: [] }, { a: ' Aunt Jo ', c: 'Sam', b: '' });
  assert.deepEqual(next.who, { a: 'Aunt Jo', c: 'Sam' });
});

test('finding 19: the plan headline is the date and roughly how far, never a day countdown', () => {
  const plan = buildDatedPlan('2027-09-18', '2026-11-14');
  assert.equal(plan.headline, 'Your wedding: Sat, Sep 18, 2027 · about 10 months away.');
  assert.doesNotMatch(plan.headline, /days to go/);
});

test('finding 20: mixed-faith couples pick more than one tradition, and every outfit counts', () => {
  for (const t of ['Protestant or Christian', 'Sikh', 'Civil, not religious']) assert.ok((TRADITIONS as readonly string[]).includes(t));
  let t = toggleTradition('', 'Jewish'); t = toggleTradition(t, 'Catholic');
  assert.deepEqual(traditionList(t), ['Jewish', 'Catholic']);
  assert.deepEqual(traditionList(toggleTradition(t, 'Jewish')), ['Catholic']);
  assert.deepEqual(traditionList('Jewish'), ['Jewish'], 'a single saved answer still reads');
  const both = applyTradition(emptyProgress(), t);
  assert.ok(hasTraditionPack(both, 'jewish') && hasTraditionPack(both, 'catholic'));
  assert.ok(!(LOVES as readonly string[]).includes('The dress'));
  assert.ok((LOVES as readonly string[]).includes('The outfits'));
});
