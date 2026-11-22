// The rating ask: the platform sheet, once, after a real success moment, never on the first
// launch day, never after an error, never gated behind a "are you happy?" question.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ratingAsk, RATING_KEY, TASKS_MOMENT } from '../src/ratingAsk';

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

test('callers ask only on their success path, and nothing gates the sheet behind a happiness question', () => {
  const packet = readFileSync('app/(tabs)/more/packet.tsx', 'utf8');
  const tryBlock = packet.slice(packet.indexOf('try {'), packet.indexOf('} catch'));
  assert.match(tryBlock, /await output\.write\(input, paper\);[\s\S]*rating\.moment\(\{ kind: 'packet' \}\)/, 'packet: ask after a successful write');
  assert.doesNotMatch(packet.slice(packet.indexOf('} catch')), /rating\.moment/, 'packet: never in the error path');
  const plan = readFileSync('app/(tabs)/plan/index.tsx', 'utf8');
  const tick = plan.slice(plan.indexOf('async function tick'), plan.indexOf('catch', plan.indexOf('async function tick')));
  assert.match(tick, /if \(!was && next\.done\[key\]\) void rating\.moment\(\{ kind: 'tasks'/, 'plan: ask only on a tick to done, after the save');
  for (const file of ['src/ratingAsk.ts', 'src/rating.ts', 'app/(tabs)/more/packet.tsx', 'app/(tabs)/plan/index.tsx']) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /enjoy(ing)? (the app|dream wedding)|are you happy|love the app/i, `${file}: no review gating`);
  }
  assert.match(readFileSync('app/_layout.tsx', 'utf8'), /rating\.opened\(\)/, 'the first-open day is recorded');
});
