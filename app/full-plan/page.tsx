'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PrintButton } from '@/components/PrintButton';
import { emptyPlan, type WeddingPlan } from '@/data/planning';
import { localToday, parseDay, plainDate } from '@/lib/dated-plan';
import { datedFullPlan, parseFullPlan, type FullPlanList } from '@/lib/full-plan';
import { emptyProgress, loadProgress, saveProgress, taskKey, toggleDone, type PlanProgress } from '@/lib/plan-progress';
import { loadSavedPlan, savePlan } from '@/lib/saved-plan';

// What a buyer of the Wedding Checklist PDF opens after paying: every task in the full
// plan, dated from HER wedding date, built for paper. The list arrives through her
// signed order link (?t=) and is then kept in this browser, so she can come back and
// print again without the link. Her date and ticks are the same ones the free planner
// uses, so nothing she already did is lost.
const LIST_KEY = 'dwb-full-plan';

export default function FullPlanPage() {
  const [list, setList] = useState<FullPlanList | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'no-link' | 'stopped'>('loading');
  const [message, setMessage] = useState('');
  const [download, setDownload] = useState('');
  const [plan, setPlan] = useState<WeddingPlan>(emptyPlan);
  const [progress, setProgress] = useState<PlanProgress>(emptyProgress());
  const [today, setToday] = useState('');

  useEffect(() => {
    setPlan(loadSavedPlan(localStorage));
    setProgress(loadProgress(localStorage));
    setToday(localToday());
    const stored = (() => { try { return parseFullPlan(JSON.parse(localStorage.getItem(LIST_KEY) ?? 'null')); } catch { return null; } })();
    const token = new URLSearchParams(window.location.search).get('t') ?? '';
    if (!token) { if (stored) { setList(stored); setState('ready'); } else setState('no-link'); return; }
    fetch(`/api/full-plan/${encodeURIComponent(token)}`, { cache: 'no-store' }).then(async res => {
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; download_url?: string };
      if (data.download_url) setDownload(data.download_url);
      const fresh = res.ok && data.ok ? parseFullPlan(data) : null;
      if (fresh) { try { localStorage.setItem(LIST_KEY, JSON.stringify(fresh)); } catch { /* shown for this visit */ } setList(fresh); setState('ready'); return; }
      if (stored) { setList(stored); setState('ready'); return; }
      setMessage(data.error ?? 'We could not open your plan just now.'); setState('stopped');
    }).catch(() => { if (stored) { setList(stored); setState('ready'); } else { setMessage('We could not reach the server. Check your connection and open the link again.'); setState('stopped'); } });
  }, []);

  const update = (patch: Partial<WeddingPlan>) => setPlan(current => { const next = { ...current, ...patch }; savePlan(localStorage, next); return next; });
  const tick = (key: string) => setProgress(current => { const next = toggleDone(current, key, new Date().toISOString()); saveProgress(localStorage, next); return next; });

  if (state === 'loading') return <p className="mx-auto max-w-3xl text-charcoal/70" data-testid="full-plan-loading">Opening your plan…</p>;
  if (state === 'no-link') return <div className="mx-auto max-w-3xl" data-testid="full-plan-no-link"><h1 className="font-serif text-4xl">Your full wedding plan</h1><p className="mt-3 leading-7 text-charcoal/70">This page opens from the link in your order email. If you have not bought the Wedding Checklist PDF yet, the free planner dates your core tasks at no cost.</p><Link href="/free-wedding-planner" className="mt-4 inline-flex min-h-11 items-center font-bold text-blue underline underline-offset-4">Open the free wedding planner ›</Link></div>;
  if (state === 'stopped' || !list) return <div className="mx-auto max-w-3xl" data-testid="full-plan-stopped"><h1 className="font-serif text-4xl">Your full wedding plan</h1><p role="alert" className="mt-3 leading-7">{message}</p>{download ? <a href={download} data-testid="full-plan-download" className="mt-5 inline-flex min-h-12 items-center rounded-2xl bg-charcoal px-6 py-3 font-bold text-linen">Download your checklist files ↓</a> : null}</div>;

  const validDate = Boolean(plan.weddingDate && parseDay(plan.weddingDate));
  const sections = validDate ? datedFullPlan(list, plan.weddingDate, today) : [];
  const total = list.tasks.length;
  const done = list.tasks.filter(task => progress.done[taskKey(task.window, task.text)]).length;

  return <div className="mx-auto max-w-3xl space-y-6" data-testid="full-plan-page">
    <section className="no-print">
      <h1 className="font-serif text-4xl leading-tight md:text-5xl">Your full wedding plan</h1>
      <p className="mt-3 leading-7 text-charcoal/70">{total} tasks, each dated from your wedding day. Print it, or tick things off here. It is saved in this browser.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold" htmlFor="full-plan-date">Your wedding date
          <input id="full-plan-date" data-testid="full-plan-date" type="date" value={plan.weddingDate} onChange={e => update({ weddingDate: e.target.value })} className="min-h-11 rounded-2xl border border-charcoal/20 px-3 text-base font-normal" />
        </label>
        <label className="grid gap-2 text-sm font-semibold" htmlFor="full-plan-names">Your names, for the top of the page (optional)
          <input id="full-plan-names" data-testid="full-plan-names" value={plan.coupleNames} maxLength={80} onChange={e => update({ coupleNames: e.target.value })} placeholder="e.g. Ana and Sam" className="min-h-11 rounded-2xl border border-charcoal/20 px-3 text-base font-normal" />
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">{validDate ? <PrintButton /> : null}{download ? <a href={download} className="inline-flex min-h-11 items-center font-bold underline underline-offset-4">Download the checklist files ↓</a> : null}</div>
    </section>

    {!validDate ? <p data-testid="full-plan-need-date" className="rounded-2xl border-2 border-charcoal bg-white p-4 font-semibold">Add your wedding date above and every task gets its date.</p> : <>
      <header data-testid="full-plan-head" className="border-b-2 border-charcoal pb-3">
        <p className="font-serif text-4xl leading-tight [overflow-wrap:anywhere]">{plan.coupleNames.trim() ? `${plan.coupleNames.trim()}: our wedding plan` : 'Our wedding plan'}</p>
        <p className="mt-1 text-lg font-semibold">{plainDate(plan.weddingDate)}{plan.locations.trim() ? ` · ${plan.locations.trim()}` : ''}</p>
        <p className="mt-1 text-sm text-charcoal/70" data-testid="full-plan-progress">{done} of {total} done</p>
      </header>
      {sections.map(section => <section key={section.id} data-testid={`full-plan-section-${section.id}`} className="print-card rounded-2xl border border-charcoal/15 bg-white p-4">
        <h2 className="font-serif text-2xl">{section.label}</h2>
        <ul className="mt-2">{section.tasks.map(task => {
          const key = taskKey(task.window, task.text);
          const ticked = Boolean(progress.done[key]);
          return <li key={task.id} data-testid="full-plan-task" className="flex items-start gap-3 border-b border-charcoal/10 py-2 last:border-b-0">
            <button type="button" aria-pressed={ticked} aria-label={ticked ? `Mark not done: ${task.text}` : `Mark done: ${task.text}`} onClick={() => tick(key)} className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center print:m-0 print:h-6 print:w-6">
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-sm ${ticked ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-charcoal/50 bg-white'}`}>{ticked ? '✓' : ''}</span>
            </button>
            <div className="min-w-0 flex-1">
              <p className={`text-sm leading-6 ${ticked ? 'text-charcoal/50 line-through' : ''}`}>{task.text}</p>
              <p className="text-xs leading-5 text-charcoal/70"><span data-testid="full-plan-task-date" className="font-semibold">{task.overdue && !ticked ? `Now (usually done by ${plainDate(task.date)})` : plainDate(task.date)}</span>{task.kind === 'payment' ? ' · payment' : ''}{task.owner ? ` · suggested: ${task.owner.toLowerCase()}` : ''}</p>
            </div>
            <span className="hidden shrink-0 whitespace-nowrap pt-0.5 text-xs print:inline">Who: <span aria-hidden="true" className="inline-block w-20 border-b border-charcoal/60">&nbsp;</span></span>
          </li>;
        })}</ul>
      </section>)}
      <p className="text-xs leading-5 text-charcoal/60">General planning timing, not legal, tax or vendor advice. Your contracts and your county’s license rules win.</p>
      <p className="hidden text-xs print:block">Dream Wedding Builder · weddingchecklistpdf.com</p>
    </>}
  </div>;
}
