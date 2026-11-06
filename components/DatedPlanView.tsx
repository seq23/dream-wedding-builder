'use client';

import { useEffect, useState } from 'react';
import { buildDatedPlan, localToday, plainDate } from '@/lib/dated-plan';

// One view of the dated plan, used by the planner, the dashboard and the packet so
// the three can never disagree. "today" is read after mount: the server does not
// know the couple's clock, and rendering it there would print yesterday's plan
// near midnight and mismatch on hydration.
export function DatedPlanView({ weddingDate, compact = false }: { weddingDate: string; compact?: boolean }) {
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => { setToday(localToday()); }, []);
  if (!today) return <p className="text-sm text-charcoal/60" data-testid="dated-plan-loading">Working out your dates…</p>;
  const plan = buildDatedPlan(weddingDate, today);
  return <div data-testid="dated-plan" data-state={plan.state} className="space-y-4">
    <p className="font-serif text-2xl leading-snug" data-testid="dated-plan-headline">{plan.headline}</p>
    {plan.warning ? <p className="rounded-2xl bg-amber-50 p-3 text-sm" data-testid="dated-plan-warning">{plan.warning}</p> : null}
    {plan.catchUp.length > 0 ? <section className="rounded-2xl border border-charcoal/10 bg-white p-4" data-testid="dated-plan-catch-up">
      <h3 className="text-base font-semibold">Check these are done (they usually happen earlier)</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">{plan.catchUp.map(task => <li key={task}>{task}</li>)}</ul>
    </section> : null}
    {plan.windows.map(window => <section key={window.id} className="rounded-2xl border border-charcoal/10 bg-white p-4" data-testid={`dated-window-${window.id}`}>
      <h3 className="text-base font-semibold">{window.label}{window.timing === 'now' ? ' · now' : ''}</h3>
      <p className="mt-1 text-sm text-charcoal/65">{plainDate(window.startsOn)} to {plainDate(window.endsOn)}</p>
      {!compact || window.timing === 'now' ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6">{window.tasks.map(task => <li key={task}>{task}</li>)}</ul> : null}
    </section>)}
    {plan.windows.length ? <p className="text-xs text-charcoal/55">General planning timing, not vendor deadlines. Your contracts and your county’s licence rules win.</p> : null}
  </div>;
}
