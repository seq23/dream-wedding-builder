import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, taskKey, toggleDone, addCustomTask } from '@core/plan-progress';
import { PLAN_WINDOWS } from '@core/dated-plan';
import { reminderSchedule, replaceReminders, shouldOffer, type Reminder } from '../src/reminders';
const now = new Date(2026, 10, 6, 12);
const schedule = (p = emptyProgress(), paid = true, needs = true) => reminderSchedule('2027-06-12', p, now, paid, needs);
test('future windows and wedding day at local 9am; no catch-up notification', () => {
  const rows = schedule();
  assert.deepEqual(rows.map(r => [r.at.getFullYear(), r.at.getMonth() + 1, r.at.getDate(), r.at.getHours()]), [[2026,12,12,9], [2027,3,12,9], [2027,5,12,9], [2027,6,5,9], [2027,6,12,9]]);
  assert.ok(rows.every(r => r.at > now));
  for (const date of ['', '2020-01-01', 'invalid']) assert.deepEqual(reminderSchedule(date, emptyProgress(), now, true), []);
  assert.deepEqual(reminderSchedule('2027-06-12', emptyProgress(), new Date(2027,5,12,10), true), []);
});
test('ticks remove task text; fully ticked window has no reminder; own tasks included', () => {
  let p = emptyProgress();
  const window = PLAN_WINDOWS.find(w => w.id === '6-months')!;
  for (const text of window.tasks) p = toggleDone(p, taskKey(window.id,text), now.toISOString());
  assert.ok(!schedule(p).some(r => r.id === 'dw-window-6-months'));
  p = addCustomTask(p, window.id, 'My own unfinished task', 'own');
  const row = schedule(p).find(r => r.id === 'dw-window-6-months')!;
  assert.equal(row.body, p.custom[0].text);
  p = toggleDone(p, taskKey(window.id,window.tasks[0]), now.toISOString());
  assert.ok(schedule(p).find(r => r.id === row.id)!.body.includes(window.tasks[0]));
});
test('paid gate and version B; Not now prevents automatic re-ask', () => {
  assert.deepEqual(schedule(emptyProgress(), false), []);
  assert.equal(schedule(emptyProgress(), false, false).length, 5);
  assert.equal(shouldOffer('unasked', false), false);
  assert.equal(shouldOffer('unasked', true), true);
  assert.equal(shouldOffer('off', true), false);
  assert.equal(shouldOffer('enabled', true), false);
  assert.equal(shouldOffer('unasked', false, false), true);
});
test('rescheduling cancels stale reminders, respects permission and cleans partial failures', async () => {
  let pending: Reminder[] = schedule(); let permitted = false; let calls = 0;
  const driver = { cancel: async () => { pending = []; }, allowed: async () => permitted, schedule: async (r: Reminder) => { pending.push(r); calls++; } };
  await replaceReminders(driver, schedule(), true); assert.deepEqual(pending, []); assert.equal(calls, 0);
  permitted = true;
  await replaceReminders(driver, schedule(), false); assert.deepEqual(pending, []);
  await replaceReminders(driver, schedule(), true); assert.equal(pending.length, 5);
  await replaceReminders(driver, [], true); assert.deepEqual(pending, []);
  await assert.rejects(replaceReminders({ ...driver, schedule: async r => { pending.push(r); throw Error('OS refused'); } }, schedule(), true));
  assert.deepEqual(pending, []);
});

test('start morning keeps the pending 9am reminder without a catch-up after 9am', async () => {
  const before = reminderSchedule('2027-06-12', emptyProgress(), new Date(2026, 11, 12, 8), true);
  assert.equal(before.filter(r => r.id === 'dw-window-6-months').length, 1);
  let pending: Reminder[] = [];
  await replaceReminders({ cancel: async () => { pending = []; }, allowed: async () => true, schedule: async r => { pending.push(r); } }, before, true);
  assert.equal(pending.find(r => r.id === 'dw-window-6-months')?.at.getHours(), 9);
  for (const when of [new Date(2026, 11, 12, 9), new Date(2026, 11, 12, 10), new Date(2026, 11, 13, 8)]) {
    assert.ok(!reminderSchedule('2027-06-12', emptyProgress(), when, true).some(r => r.id === 'dw-window-6-months'));
  }
});
