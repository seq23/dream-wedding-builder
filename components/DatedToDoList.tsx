'use client';

import { useState } from 'react';
import { DatedPlanView } from '@/components/DatedPlanView';

// The to-do list page's one field: her wedding date in, the dated list out, on the page
// itself. The same DatedPlanView the planner uses, so the two can never disagree.
export function DatedToDoList() {
  const [date, setDate] = useState('');
  return <section className="no-print rounded-[12px] bg-white p-7 md:p-9" data-testid="todo-dated-list">
    <h2 className="font-serif text-4xl">Your list, dated</h2>
    <label htmlFor="todo-date" className="mt-4 block font-bold">Your wedding date</label>
    <input id="todo-date" data-testid="todo-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-2 min-h-12 w-full max-w-xs rounded-xl border border-charcoal/25 bg-ivory px-4 text-base" />
    <p className="mt-2 text-sm text-charcoal/60">No account and no email. Your ticks stay in this browser.</p>
    {date ? <div className="mt-6 space-y-4"><DatedPlanView weddingDate={date} /></div> : null}
  </section>;
}
