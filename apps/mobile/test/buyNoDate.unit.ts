import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkout } from '../src/billing/checkout';
import type { PurchasesProvider } from '../src/billing/provider';
import { eventStore } from '../src/billing/eventStore';
import { addEvent, emptyLedger } from '../src/billing/events';
import { defaultEventName } from '../src/billing/eventName';
import { dateStore } from '../src/weddingDate';
import { sharedPlan } from '../src/sharing/session';
import { fullPlanRows } from '../src/planTasks';
import { buildDatedPlan } from '@core/dated-plan';
import { emptyProgress } from '@core/plan-progress';

// "I don't have a date yet" is an offered path, so buying must never wait on a date
// (her rulings 14 Nov 2026: names optional, date changes free; sim retest d02s.png).
const list = { windows: [{ id: '12-plus', label: '12+ months' }, { id: 'wedding-week', label: 'Wedding week' }],
  tasks: [{ id: 'a', window: '12-plus', text: 'Book the venue', daysBefore: 365, owner: '', kind: 'payment' as const },
    { id: 'b', window: 'wedding-week', text: 'Final payments', daysBefore: 3, owner: '', kind: 'task' as const }] };
function setup() {
  const data = new Map<string, string>(), calls: string[] = [];
  const storage = { async getItem(k: string) { return data.get(k) ?? null; }, async setItem(k: string, v: string) { data.set(k, v); } };
  const provider: PurchasesProvider = { available: true, async products() { return []; },
    async purchase(id) { calls.push(id); return { userId: 'identity', active: [] }; },
    async restore() { calls.push('restore'); return { userId: 'identity', active: [] }; } };
  const downloads = { async refresh() { return { list, packs: [] }; } };
  return { data, calls, storage, provider, downloads };
}

test('with no wedding date, buying the full plan goes to the store and the plan works undated until she adds one', async () => {
  const s = setup();
  // No date saved: the default name has no date in it.
  assert.equal(await dateStore(s.storage).read(), null);
  const name = defaultEventName(await dateStore(s.storage).read());
  assert.equal(name, 'Our wedding');
  await checkout(s.storage, s.provider, s.downloads, () => 'first').purchase(name, '', 'dw_full_plan');
  assert.deepEqual(s.calls, ['dw_full_plan'], 'the store sheet opened');
  // The paid event survives a reload from storage, with no date.
  const event = await eventStore(s.storage).active();
  assert.equal(event?.fullPlan, true);
  assert.equal(event?.date, '');
  assert.equal(await dateStore(s.storage).read(), null);
  // The shared-plan record (the partner's phone) accepts an undated event too.
  assert.equal(sharedPlan({ event: { id: 'first', name, date: '' }, list, ticks: {}, joined: false }).event.date, '');
  // The plan shows every task, none late, with the gentle "add your date" line.
  const today = '2026-11-14';
  const undated = fullPlanRows(list, emptyProgress(), '', today);
  assert.equal(undated.length, 2);
  assert.ok(undated.every(r => r.dueOn === null && !r.late));
  assert.equal(buildDatedPlan('', today).state, 'none');
  assert.match(buildDatedPlan('', today).headline, /Add your wedding date/);
  // Adding the date later is free and dates the plan.
  await dateStore(s.storage).save('2028-06-12', today);
  assert.equal(await dateStore(s.storage).read(), '2028-06-12');
  assert.equal((await eventStore(s.storage).active())?.fullPlan, true);
  assert.deepEqual(fullPlanRows(list, emptyProgress(), '2028-06-12', today).map(r => r.dueOn), ['2027-06-13', '2028-06-09']);
  // A malformed date is still refused; only "no date" is new.
  assert.throws(() => addEvent(emptyLedger(), 'x', 'Our wedding', '2027-02-30'), /INVALID_EVENT/);
});
