// The app's core is the live Builder's own planning logic, read from the site's lib/
// through @core/* (tsconfig.json, metro.config.js): one source, so the app and
// weddingchecklistpdf.com/free-wedding-planner can never disagree about a date.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDatedPlan, plainDate } from '@core/dated-plan';
import { emptyProgress, taskKey, toggleDone, addCustomTask } from '@core/plan-progress';
import { buildIcs } from '@core/plan-ics';

test('a June 2027 wedding seen on 6 Nov 2026 gets the site’s dated windows', () => {
  const plan = buildDatedPlan('2027-06-12', '2026-11-06');
  assert.equal(plan.state, 'future');
  assert.equal(plan.daysToGo, 218);
  assert.equal(plan.catchUp.length, 4, 'the closed 12+ month window folds into catch-up');
  const now = plan.windows.filter(w => w.timing === 'now');
  assert.equal(now.length, 1);
  assert.equal(now[0].id, '9-months');
  assert.equal(plainDate(now[0].endsOn), 'Fri 11 Dec 2026');
  assert.deepEqual(plan.windows.map(w => w.startsOn), ['2026-11-06', '2026-12-12', '2027-03-12', '2027-05-12', '2027-06-05']);
});

test('ticks and own tasks use the site’s progress shape', () => {
  let p = toggleDone(emptyProgress(), taskKey('9-months', 'Book the band or DJ'), '2026-11-06T21:00:00Z');
  p = addCustomTask(p, '9-months', 'Book the church for the ceremony', 'c1');
  assert.equal(Object.keys(p.done).length, 1);
  assert.equal(p.custom[0].text, 'Book the church for the ceremony');
  assert.equal(toggleDone(p, taskKey('9-months', 'Book the band or DJ'), 'x').done[taskKey('9-months', 'Book the band or DJ')], undefined, 'a second tap unticks');
});

test('reminder dates are the window starts still ahead (the site’s calendar file)', () => {
  const plan = buildDatedPlan('2027-06-12', '2026-11-06');
  const ics = buildIcs(plan, '2027-06-12', (_id, tasks) => tasks, '20261106T000000Z');
  assert.ok(ics);
  const starts = [...ics!.matchAll(/DTSTART;VALUE=DATE:(\d{8})/g)].map(m => m[1]);
  assert.deepEqual(starts, ['20261106', '20261212', '20270312', '20270512', '20270605', '20270612']);
  assert.equal(buildIcs(buildDatedPlan('2020-01-01', '2026-11-06'), '2020-01-01', (_i, t) => t, 'x'), null, 'no reminders for a past date');
});
