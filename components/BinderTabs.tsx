'use client';
import { useState } from 'react';
import { PLAN_WINDOWS } from '@/lib/dated-plan';

// The Dream Wedding binder (design system, 6 Nov 2026): tabs are the checklist's real
// planning windows and the page holds the free planner's own tasks for that window
// (lib/dated-plan.ts), so the picture on the homepage is the product, not a mock.
const TABS = [
  { id: '12-plus', tab: '12+ months' },
  { id: '9-months', tab: '9 months' },
  { id: '6-months', tab: '6 months' },
  { id: 'wedding-week', tab: 'Wedding week' }
] as const;

export function BinderTabs({ plannerHref }: { plannerHref: string }) {
  const [active, setActive] = useState<string>(TABS[0].id);
  const win = PLAN_WINDOWS.find((w) => w.id === active)!;
  return <div data-testid="binder-tabs" className="w-full max-w-md">
    <div role="tablist" aria-label="Planning windows" className="flex items-end gap-1 px-2">
      {TABS.map((t) => {
        const selected = t.id === active;
        return <button key={t.id} type="button" role="tab" id={`binder-tab-${t.id}`} aria-selected={selected} aria-controls="binder-page"
          onClick={() => setActive(t.id)}
          className={`min-h-11 min-w-0 flex-1 rounded-t-[10px] px-1 pb-1.5 pt-2 text-center font-mono text-[11px] font-medium uppercase leading-[14px] tracking-[.04em] ${selected ? 'bg-blue text-white' : 'bg-coral text-midnight'}`}>{t.tab}</button>;
      })}
    </div>
    <div id="binder-page" role="tabpanel" aria-labelledby={`binder-tab-${active}`} className="grid gap-1 rounded-[10px] bg-white p-4 shadow-soft">
      <p className="font-mono text-xs font-medium uppercase tracking-[.12em] text-midnight-muted">{win.label}</p>
      <ul className="grid">
        {win.tasks.map((task) => <li key={task} className="flex min-h-10 items-center gap-3 border-b border-rule py-2 text-[15px] leading-[22px] last:border-b-0"><span aria-hidden="true" className="h-[18px] w-[18px] flex-none rounded-[4px] border-[1.5px] border-midnight-muted" />{task}</li>)}
      </ul>
      <a href={`${plannerHref}#your-date`} className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-blue underline underline-offset-4">Date every task from your wedding day ›</a>
    </div>
  </div>;
}
