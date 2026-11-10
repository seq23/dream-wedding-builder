import { describe, expect, it } from 'vitest';
import { buildDatedPlan } from '@/lib/dated-plan';
import { thisWeek } from '@/lib/this-week';

// The card on top of her plan: the next three tasks she has not ticked, in plan order,
// each with a date, and when the next window opens.
describe('this week', () => {
  const plan = buildDatedPlan('2027-10-15', '2026-11-10');
  const base = (_id: string, tasks: string[]) => tasks;

  it('shows the first three undone tasks with the day their window closes, and skips ticked ones', () => {
    const first = thisWeek(plan, base, () => false);
    expect(first.tasks).toHaveLength(3);
    const current = plan.windows.find(w => w.timing === 'now')!;
    expect(first.tasks.map(t => t.text)).toEqual(current.tasks.slice(0, 3));
    for (const task of first.tasks) expect(task.by).toBe(current.endsOn);

    const ticked = new Set(first.tasks.slice(0, 2).map(t => t.text));
    const second = thisWeek(plan, base, (_w, text) => ticked.has(text));
    expect(second.tasks[0].text).toBe(first.tasks[2].text);
    expect(second.tasks.some(t => ticked.has(t.text))).toBe(false);
    expect(second.left).toBe(first.left - 2);
  });

  it('includes her own tasks and names the day the next window opens', () => {
    const mine = thisWeek(plan, (id, tasks) => (id === plan.windows.find(w => w.timing === 'now')!.id ? ['Book the church', ...tasks] : tasks), () => false);
    expect(mine.tasks[0].text).toBe('Book the church');
    const later = plan.windows.find(w => w.timing === 'later')!;
    expect(mine.nextWindow).toEqual({ label: later.label, opensOn: later.startsOn });
  });

  it('puts overdue catch-up tasks first for a close date, and is empty when everything is ticked', () => {
    const close = buildDatedPlan('2027-01-20', '2026-11-10');
    expect(close.catchUp.length).toBeGreaterThan(0);
    const week = thisWeek(close, base, () => false);
    expect(week.tasks[0]).toEqual({ windowId: 'catch-up', text: close.catchUp[0], by: '' });
    expect(thisWeek(close, base, () => true)).toMatchObject({ tasks: [], left: 0 });
  });
});

import { parseProgress, taskKey } from '@/lib/plan-progress';
import { PLAN_WINDOWS } from '@/lib/dated-plan';
describe('a respelled task keeps its tick', () => {
  it('a tick made under "marriage licence" still shows on the "marriage license" task', () => {
    const task = PLAN_WINDOWS.flatMap(w => w.tasks.map(text => ({ id: w.id, text }))).find(t => t.text.includes('marriage license'))!;
    const old = taskKey(task.id, task.text.replace('marriage license', 'marriage licence'));
    expect(old).not.toBe(taskKey(task.id, task.text));
    expect(parseProgress(JSON.stringify({ done: { [old]: '2026-11-01T00:00:00Z' }, custom: [] })).done[taskKey(task.id, task.text)]).toBe('2026-11-01T00:00:00Z');
  });
});
