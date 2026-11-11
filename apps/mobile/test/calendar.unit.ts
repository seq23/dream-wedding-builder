import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, toggleDone, taskKey } from '@core/plan-progress';
import { PLAN_WINDOWS } from '@core/dated-plan';
import { addOwnTask, ownTaskKey } from '../src/planTasks';
import { calendarFile } from '../src/calendar';

test('free calendar exports dated open tasks including own tasks, without completed tasks', () => {
  const now = new Date('2026-11-06T12:00:00Z');
  const window = PLAN_WINDOWS.find(w => w.id === '9-months')!;
  let progress = toggleDone(emptyProgress(), taskKey(window.id, window.tasks[0]), now.toISOString());
  progress = addOwnTask(progress, window.id, 'Arrange flowers; ask family', 'flowers');
  progress = addOwnTask(progress, window.id, 'Finished personal task', 'finished');
  progress = toggleDone(progress, ownTaskKey('finished'), now.toISOString());
  const text = calendarFile('2027-06-12', progress, now);
  assert.ok(text.includes('DTSTART;VALUE=DATE:20270612'));
  assert.ok(text.includes('DTSTART;VALUE=DATE:20261212'));
  assert.ok(text.includes('Arrange flowers\\; ask family'));
  assert.ok(!text.includes(window.tasks[0]));
  assert.ok(!text.includes('Finished personal task'));
  for (const date of [null, '', '2020-01-01', 'invalid']) assert.throws(() => calendarFile(date, progress, now));
});
