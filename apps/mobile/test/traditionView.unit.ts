import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress } from '@core/plan-progress';
import { loadTraditions } from '../src/traditionView';

test('traditions returns saved tasks, rejects failed reads and ends stalled reads without accepting late data', async () => {
  const progress = emptyProgress();
  assert.equal(await loadTraditions(async () => progress), progress);
  await assert.rejects(loadTraditions(async () => { throw Error('storage unavailable'); }), /storage unavailable/);
  let finish!: (p: typeof progress) => void;
  const stalled = new Promise<typeof progress>(resolve => { finish = resolve; });
  const result = loadTraditions(() => stalled, 5);
  await assert.rejects(result, /TRADITIONS_LOAD_TIMEOUT/);
  finish(progress);
  await assert.rejects(result, /TRADITIONS_LOAD_TIMEOUT/);
});
