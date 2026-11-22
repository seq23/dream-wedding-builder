// The rating ask: the platform sheet, once, after a real success moment, never on the first
// launch day, never after an error, never gated behind a "are you happy?" question.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSuccessMoment, ratingAsk, RATING_KEY, TASKS_MOMENT } from '../src/ratingAsk';
import { doneCount, screenRows, taskRows } from '../src/planTasks';
import { emptyProgress } from '@core/plan-progress';

function memory() {
  const data = new Map<string, string>();
  return { data, getItem: async (k: string) => data.get(k) ?? null, setItem: async (k: string, v: string) => { data.set(k, v); } };
}
function sheet(available = true) {
  const s = { asked: 0, isAvailableAsync: async () => available, requestReview: async () => { s.asked++; } };
  return s;
}
const at = (iso: string) => () => new Date(iso);

test('never on the first launch day, even after a success moment', async () => {
  const store = memory(); const s = sheet();
  const day1 = ratingAsk(store, s, at('2027-01-04T10:00:00Z'));
  await day1.opened();
  assert.equal(await day1.moment({ kind: 'packet' }), false);
  assert.equal(s.asked, 0);
});

test('a later day: printing the plan asks once, and never again', async () => {
  const store = memory(); const s = sheet();
  await ratingAsk(store, s, at('2027-01-04T10:00:00Z')).opened();
  const day2 = ratingAsk(store, s, at('2027-01-05T10:00:00Z'));
  assert.equal(await day2.moment({ kind: 'packet' }), true);
  assert.equal(await day2.moment({ kind: 'packet' }), false);
  assert.equal(await day2.moment({ kind: 'tasks', done: 40 }), false);
  const later = ratingAsk(store, s, at('2027-03-01T10:00:00Z'));
  await later.opened(); // a reopen never resets the cap
  assert.equal(await later.moment({ kind: 'packet' }), false);
  assert.equal(s.asked, 1);
});

test('ticking tasks asks only from the 10th done', async () => {
  const store = memory(); const s = sheet();
  await ratingAsk(store, s, at('2027-01-04T10:00:00Z')).opened();
  const day2 = ratingAsk(store, s, at('2027-01-06T10:00:00Z'));
  assert.equal(await day2.moment({ kind: 'tasks', done: TASKS_MOMENT - 1 }), false);
  assert.equal(s.asked, 0);
  assert.equal(await day2.moment({ kind: 'tasks', done: TASKS_MOMENT }), true);
  assert.equal(s.asked, 1);
});

test('no store on the device (web preview): nothing asked and the one ask is kept for later', async () => {
  const store = memory();
  await ratingAsk(store, sheet(false), at('2027-01-04T10:00:00Z')).opened();
  assert.equal(await ratingAsk(store, sheet(false), at('2027-01-05T10:00:00Z')).moment({ kind: 'packet' }), false);
  assert.equal(JSON.parse(store.data.get(RATING_KEY)!).askedOn, undefined);
});

test('no first-open record (unreadable storage) never asks', async () => {
  const s = sheet();
  const broken = { getItem: async () => { throw new Error('disk'); }, setItem: async () => { throw new Error('disk'); } };
  assert.equal(await ratingAsk(broken, s, at('2027-01-05T10:00:00Z')).moment({ kind: 'packet' }), false);
  assert.equal(s.asked, 0);
});

test('the first launch day is her local day: an evening first open in Chicago still blocks that evening', async () => {
  const prev = process.env.TZ; process.env.TZ = 'America/Chicago';
  try {
    const store = memory(); const s = sheet();
    await ratingAsk(store, s, at('2027-01-04T23:00:00Z')).opened(); // 5 pm Central
    assert.equal(await ratingAsk(store, s, at('2027-01-05T01:00:00Z')).moment({ kind: 'packet' }), false); // 7 pm, same local day, next UTC day
    assert.equal(await ratingAsk(store, s, at('2027-01-05T15:00:00Z')).moment({ kind: 'packet' }), true); // next morning
  } finally { process.env.TZ = prev; }
});

test('the ask cannot be recorded: nothing is asked and nothing throws', async () => {
  const s = sheet();
  const data = new Map<string, string>([[RATING_KEY, JSON.stringify({ firstSeenOn: '2027-01-01' })]]);
  const readOnly = { getItem: async (k: string) => data.get(k) ?? null, setItem: async () => { throw new Error('disk full'); } };
  assert.equal(await ratingAsk(readOnly, s, at('2027-01-05T15:00:00Z')).moment({ kind: 'packet' }), false);
  assert.equal(s.asked, 0);
});

test('the 10th-task moment counts what the screen counts: stale ticks and off-list keys never count', () => {
  const progress = emptyProgress();
  const real = taskRows(progress).slice(0, 9).map(r => r.key);
  const done: Record<string, string> = Object.fromEntries(real.map(k => [k, '2027-01-05T10:00:00Z']));
  for (let i = 0; i < 5; i++) done[`renamed-or-removed-${i}`] = '2027-01-05T10:00:00Z';
  const rows = screenRows({ ...progress, done }, null, '2027-09-18', '2027-01-05');
  assert.equal(doneCount(rows), 9);
  assert.equal(isSuccessMoment({ kind: 'tasks', done: doneCount(rows) }), false);
  const tenth = taskRows(progress)[9].key;
  assert.equal(doneCount(screenRows({ ...progress, done: { ...done, [tenth]: '2027-01-05T11:00:00Z' } }, null, '2027-09-18', '2027-01-05')), TASKS_MOMENT);
});
