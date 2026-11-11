import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress } from '@core/plan-progress';
import { nextTaskRows, completionDay, taskRows } from '../src/planTasks';
test('next tasks fills three slots and replaces completed tasks', () => {
 const p = emptyProgress(); const all = taskRows(p); p.done[all[0].key] = '2026-11-06T15:00:00Z';
 assert.deepEqual(nextTaskRows(p).map(r => r.key), all.slice(1,4).map(r => r.key));
 for (const row of all) p.done[row.key] = '2026-11-06T15:00:00Z';
 assert.deepEqual(nextTaskRows(p), []);
});
test('completion date omits time and year', () => { assert.equal(completionDay('2026-11-06T15:00:00Z'), '6 Nov'); });
