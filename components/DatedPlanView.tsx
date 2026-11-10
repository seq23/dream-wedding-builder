'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { buildDatedPlan, localToday, plainDate } from '@/lib/dated-plan';
import { addCustomTask, emptyProgress, loadProgress, removeCustomTask, saveProgress, taskKey, toggleDone, type PlanProgress } from '@/lib/plan-progress';
import { buildIcs } from '@/lib/plan-ics';
import { thisWeek } from '@/lib/this-week';

// One view of the dated plan, used by the planner, the dashboard and the packet so
// the three can never disagree. "today" is read after mount: the server does not
// know the couple's clock, and rendering it there would print yesterday's plan
// near midnight and mismatch on hydration.
//
// Ticks, the couple's own tasks and calendar reminders (journey review against
// Zola, The Knot and WeddingWire, 6 Nov 2026: all three gate these behind an
// account; here they live in this browser with no account).
export function DatedPlanView({ weddingDate, compact = false, readOnly = false }: { weddingDate: string; compact?: boolean; readOnly?: boolean }) {
  const [today, setToday] = useState<string | null>(null);
  const [progress, setProgress] = useState<PlanProgress>(emptyProgress());
  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  useEffect(() => {
    setToday(localToday());
    setProgress(loadProgress(localStorage));
    const sync = () => setProgress(loadProgress(localStorage));
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  if (!today) return <p className="text-sm text-charcoal/60" data-testid="dated-plan-loading">Working out your dates…</p>;
  const plan = buildDatedPlan(weddingDate, today);

  const update = (next: PlanProgress) => { setProgress(next); saveProgress(localStorage, next); };
  const tasksFor = (windowId: string, base: string[]) => [...base, ...progress.custom.filter(c => c.windowId === windowId).map(c => c.text)];
  const allKeys = [...plan.catchUp.map(t => taskKey('catch-up', t)), ...plan.windows.flatMap(w => tasksFor(w.id, w.tasks).map(t => taskKey(w.id, t)))];
  const doneCount = allKeys.filter(k => progress.done[k]).length;

  const downloadIcs = () => {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const ics = buildIcs(plan, weddingDate, (id, base) => tasksFor(id, base).filter(t => !progress.done[taskKey(id, t)]), stamp);
    if (!ics) return;
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'wedding-plan-reminders.ics'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const week = thisWeek(plan, tasksFor, (windowId, text) => Boolean(progress.done[taskKey(windowId, text)]));

  const Task = ({ windowId, text, customId }: { windowId: string; text: string; customId?: string }) => {
    const key = taskKey(windowId, text);
    const done = Boolean(progress.done[key]);
    return <li className="flex items-start gap-3 py-1">
      {readOnly ? <span aria-hidden="true" className="mt-0.5 inline-block h-5 w-5 shrink-0 rounded-full border border-charcoal/40 text-center text-xs leading-5">{done ? '✓' : ''}</span>
        : <button type="button" data-testid="dated-task-toggle" aria-pressed={done} aria-label={done ? `Mark not done: ${text}` : `Mark done: ${text}`} onClick={() => update(toggleDone(progress, key, new Date().toISOString()))} className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center">
          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-sm ${done ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-charcoal/40 bg-white'}`}>{done ? '✓' : ''}</span>
        </button>}
      <span className={`pt-0.5 text-sm leading-6 ${done ? 'text-charcoal/50 line-through' : ''}`} data-testid="dated-task-text">{text}</span>
      {readOnly ? <span data-testid="dated-task-owner" className="ml-auto shrink-0 whitespace-nowrap pt-0.5 text-xs text-charcoal/70">Who: <span aria-hidden="true" className="inline-block w-24 border-b border-charcoal/60 align-baseline">&nbsp;</span></span> : null}
      {customId && !readOnly ? <button type="button" data-testid="dated-task-remove" onClick={() => update(removeCustomTask(progress, customId))} className="ml-auto min-h-11 shrink-0 px-2 text-xs font-semibold text-charcoal/60 underline">Remove</button> : null}
    </li>;
  };

  const addTask = (event: FormEvent, windowId: string) => {
    event.preventDefault();
    update(addCustomTask(progress, windowId, draft, `c${Date.now().toString(36)}`));
    setDraft(''); setAdding(null);
  };

  return <div data-testid="dated-plan" data-state={plan.state} className="space-y-4">
    <p className="font-serif text-2xl leading-snug" data-testid="dated-plan-headline">{plan.headline}</p>
    {allKeys.length ? <p className="text-sm text-charcoal/70" data-testid="dated-plan-progress">{doneCount} of {allKeys.length} done{readOnly ? '' : ' · saved in this browser'}</p> : null}
    {plan.warning ? <p className="rounded-2xl bg-amber-50 p-3 text-sm" data-testid="dated-plan-warning">{plan.warning}</p> : null}
    {plan.state === 'future' && !readOnly ? <section data-testid="this-week" className="rounded-2xl border-2 border-charcoal bg-white p-4">
      <h3 className="font-serif text-2xl leading-tight">{week.tasks.length ? 'Do these next' : 'Everything so far is ticked'}</h3>
      {week.tasks.length ? <ul className="mt-2 grid gap-2">{week.tasks.map(task => <li key={`${task.windowId}:${task.text}`} data-testid="this-week-task" className="text-sm leading-6"><span className="font-semibold">{task.text}</span><span className="block text-charcoal/65">{task.by ? `by ${plainDate(task.by)}` : 'usually done by now'}</span></li>)}</ul> : null}
      {week.nextWindow ? <p data-testid="this-week-next" className="mt-3 text-sm text-charcoal/70">Your next set of tasks ({week.nextWindow.label.toLowerCase()}) starts {plainDate(week.nextWindow.opensOn)}.</p> : null}
      <button type="button" data-testid="dated-plan-ics" onClick={downloadIcs} className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-blue px-5 py-3 text-center text-base font-bold text-white">Put these dates in my calendar ↓</button>
      <p className="mt-2 text-xs leading-5 text-charcoal/60">Downloads a calendar file for your phone or computer with every task you have not ticked. We do not send reminders ourselves.</p>
    </section> : null}
    {plan.catchUp.length > 0 ? <section className="rounded-2xl border border-charcoal/10 bg-white p-4" data-testid="dated-plan-catch-up">
      <h3 className="text-base font-semibold">Check these are done (they usually happen earlier)</h3>
      <ul className="mt-2">{plan.catchUp.map(task => <Task key={task} windowId="catch-up" text={task} />)}</ul>
    </section> : null}
    {plan.windows.map(window => {
      const custom = progress.custom.filter(c => c.windowId === window.id);
      const showTasks = !compact || window.timing === 'now';
      return <section key={window.id} className="print-window rounded-2xl border border-charcoal/10 bg-white p-4" data-testid={`dated-window-${window.id}`}>
        <h3 className="text-base font-semibold">{window.id === '12-plus' && (plan.daysToGo ?? 9999) < 365 ? 'From now to 9 months before' : `${window.label}${window.timing === 'now' ? ' · now' : ''}`}</h3>
        <p className="mt-1 text-sm text-charcoal/65">{plainDate(window.startsOn)} to {plainDate(window.endsOn)}</p>
        {showTasks ? <ul className="mt-2">
          {window.tasks.map(task => <Task key={task} windowId={window.id} text={task} />)}
          {custom.map(c => <Task key={c.id} windowId={window.id} text={c.text} customId={c.id} />)}
        </ul> : null}
        {showTasks && !readOnly ? (adding === window.id
          ? <form onSubmit={e => addTask(e, window.id)} className="mt-2 flex flex-wrap gap-2">
              <label className="sr-only" htmlFor={`add-${window.id}`}>Your own task</label>
              <input id={`add-${window.id}`} data-testid="dated-task-input" autoFocus value={draft} maxLength={140} onChange={e => setDraft(e.target.value)} placeholder="e.g. Book the church" className="min-h-11 min-w-0 flex-1 rounded-2xl border border-charcoal/20 px-3 text-base" />
              <button type="submit" data-testid="dated-task-save" className="min-h-11 rounded-full bg-charcoal px-4 text-sm font-bold text-linen">Add</button>
              <button type="button" onClick={() => { setAdding(null); setDraft(''); }} className="min-h-11 px-2 text-sm text-charcoal/60">✕ Cancel</button>
            </form>
          : <button type="button" data-testid={`dated-task-add-${window.id}`} onClick={() => { setAdding(window.id); setDraft(''); }} className="mt-1 min-h-11 text-sm font-semibold text-charcoal/70 underline underline-offset-4">+ Add your own task</button>) : null}
      </section>;
    })}
    {plan.windows.length ? <p className="text-xs text-charcoal/55">General planning timing, not vendor deadlines. Your contracts and your county’s license rules win.</p> : null}
  </div>;
}
