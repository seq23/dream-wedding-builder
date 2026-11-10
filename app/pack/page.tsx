'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Badge } from '@/components/Card';
import { PrintButton } from '@/components/PrintButton';
import { trends } from '@/data/trends';
import { disclaimers } from '@/data/disclaimers';
import { money } from '@/lib/format';
import { budgetModes, budgetReality, designSummary, emptyPlan, hiddenFeeChecklist, protectedPriorities, riskChecklist, selectedVenues, selectedVendors, type WeddingPlan } from '@/data/planning';
import { budgetPlan } from '@/lib/budget-plan';
import { nextQuestions } from '@/lib/next-questions';
import { loadSavedPlan, savePlan } from '@/lib/saved-plan';
import { DatedPlanView } from '@/components/DatedPlanView';
import { FullPlanCard } from '@/components/FullPlanCard';
import { AiDraftLabel } from '@/components/AiDraftCard';
import { EmailAsk } from '@/components/BuilderEmailGate';
import { plainDate } from '@/lib/dated-plan';

// The printable plan. It prints only what she filled in or picked (hostile review,
// 10 Nov 2026: it listed three venues she never chose as "User-selected", left
// "[guest count]" blanks in a letter although the count was known, and never showed
// her budget). A section with nothing in it is not drawn.
export default function PackPage() {
  const [plan, setPlan] = useState<WeddingPlan>(emptyPlan);

  useEffect(() => { setPlan(loadSavedPlan(localStorage)); }, []);
  const setNames = (coupleNames: string) => setPlan(current => { const next = { ...current, coupleNames }; savePlan(localStorage, next); return next; });

  const budget = budgetPlan(plan);
  const mode = budgetModes.find(item => item.id === plan.budgetMode && item.id !== 'unknown')?.title ?? '';
  const design = designSummary(plan);
  const ideas = trends.filter(t => plan.selectedTrends.includes(t.id));
  const venues = selectedVenues(plan);
  const vendors = selectedVendors(plan);
  const top = protectedPriorities(plan);
  const risks = riskChecklist(plan);
  const questions = nextQuestions(plan);
  const basics: [string, string][] = ([
    ['Wedding date', plan.weddingDate ? plainDate(plan.weddingDate) : ''],
    ['Place', plan.locations],
    ['Guests', plan.guestCount],
    ['Season', plan.season],
    ['Your budget', budget.budget ? `${money(Math.min(budget.budget, budget.limit))}${budget.hard ? ' (hard limit)' : ''}` : budget.words],
    ['Matters most', top.join(', ')],
    ['What you picture', plan.outdoorNeeds],
    ['Cannot change', plan.fixedItems],
    ['Whole venue to yourselves', plan.fullBuyout],
    ['Guests sleeping at the venue', [plan.onsiteLodging, plan.onsiteSleepCount].filter(Boolean).join(', ')],
    ['Your own caterer', plan.outsideCatering],
    ['Rain plan', plan.rainBackup],
    ['Access needs', plan.accessibilityNeeds],
    ['Food needs', plan.culturalFoodNeeds]
  ] as [string, string][]).filter(([, value]) => value && value.trim());
  const nothingYet = basics.length === 0 && !venues.length && !vendors.length && !ideas.length;
  // The letter uses only facts she gave; a missing one is left out, never bracketed.
  const letterFacts = [plan.locations.trim() ? `in ${plan.locations.trim()}` : '', plan.weddingDate ? `on ${plainDate(plan.weddingDate)}` : plan.season.trim() ? `in ${plan.season.trim()}` : '', plan.guestCount.trim() ? `for about ${plan.guestCount.trim()} guests` : ''].filter(Boolean).join(' ');
  const letter = `Hello,\n\nWe are planning a wedding${letterFacts ? ` ${letterFacts}` : ''}.${plan.outdoorNeeds.trim() ? ` We are picturing: ${plan.outdoorNeeds.trim()}.` : ''}${design.use.length ? ` The feel we want: ${design.use.join(', ')}.` : ''}\n\nCould you tell us whether you are free, your starting price, what it includes, what usually costs extra (service charge, tax, set-up, overtime), and any minimum spend?\n\nThank you.`;

  // The plan itself needs no email; the printable copy is one of the two things an
  // email is asked for. Anyone who already gave one goes straight in.
  return <EmailAsk heading="Your plan, ready to print" lead="Enter your email to open the printable copy of your plan: your dated tasks, your budget and the questions for each vendor on one page. Your plan itself stays in this browser." button="Open my printable plan ›"><div className="mx-auto max-w-3xl space-y-6" data-testid="pack-page">
    <section className="no-print"><Link href="/free-wedding-planner" className="inline-flex min-h-11 items-center font-bold text-blue underline underline-offset-4">← Back to the planner</Link><div className="mt-2 flex flex-wrap items-start justify-between gap-4"><div><Badge>From the free wedding planner</Badge><h1 className="mt-4 font-serif text-5xl">Your wedding plan</h1><p className="mt-3 text-charcoal/70">Everything you have filled in so far, on one page to print or save as a PDF. It shows only what you entered or picked.</p></div><PrintButton /></div>
      <label className="mt-5 grid max-w-md gap-2 text-sm font-semibold" htmlFor="pack-names">Your names, for the top of the page (optional)
        <input id="pack-names" data-testid="pack-names" value={plan.coupleNames} maxLength={80} onChange={e => setNames(e.target.value)} placeholder="e.g. Ana and Sam" className="min-h-11 rounded-2xl border border-charcoal/20 px-3 text-base font-normal" />
      </label>
    </section>

    {/* The top of the printed page: whose plan it is and the day. Screen shows it too, so she sees what prints. */}
    {!nothingYet && <header data-testid="pack-print-head" className="border-b-2 border-charcoal pb-3">
      <p className="font-serif text-4xl leading-tight [overflow-wrap:anywhere]">{plan.coupleNames.trim() ? `${plan.coupleNames.trim()}: our wedding plan` : 'Our wedding plan'}</p>
      {plan.weddingDate ? <p className="mt-1 text-lg font-semibold">{plainDate(plan.weddingDate)}{plan.locations.trim() ? ` · ${plan.locations.trim()}` : ''}</p> : null}
    </header>}

    {nothingYet && <Card className="print-card" data-testid="pack-empty"><p className="font-semibold">Nothing to print yet.</p><p className="mt-2 text-sm text-charcoal/70">Add your date, guest count or budget in the planner and they appear here by themselves.</p><Link href="/free-wedding-planner" className="mt-3 inline-flex min-h-11 items-center font-bold text-blue underline underline-offset-4">Open the free wedding planner ›</Link></Card>}

    {basics.length > 0 && <Card className="print-card" data-testid="pack-basics"><h2 className="font-serif text-3xl">The basics</h2><dl className="mt-3 grid gap-1 text-sm">{basics.map(([label, value]) => <div key={label} className="flex items-baseline justify-between gap-4 border-b border-charcoal/10 py-2"><dt className="text-charcoal/60">{label}</dt><dd className="min-w-0 text-right font-semibold [overflow-wrap:anywhere]">{value}</dd></div>)}</dl></Card>}

    {(budget.budget > 0 || budget.words) && <Card className="print-card" data-testid="pack-budget"><h2 className="font-serif text-3xl">Your budget{budget.budget ? `: ${money(Math.min(budget.budget, budget.limit))}` : ''}</h2>{mode ? <p className="mt-2 text-sm text-charcoal/70">{mode}.</p> : null}<p className="mt-3 rounded-2xl bg-ivory p-4 text-sm leading-6">{budgetReality(plan)}</p>{budget.lines.length > 0 && <><ul className="mt-3 grid gap-1 text-sm">{budget.lines.map(line => <li key={line.id} className="flex items-baseline justify-between gap-3 border-b border-charcoal/10 py-2"><span>{line.label}{line.yours ? ' (your number)' : ''}</span><span className="font-mono font-semibold">{money(line.amount)}</span></li>)}</ul><p className="mt-2 text-xs leading-5 text-charcoal/60">A starting split to edit, not a price list. Your quotes replace these numbers.</p></>}{plan.saveAreas.trim() ? <p className="mt-3 text-sm">Cut first: {plan.saveAreas}</p> : null}{plan.noCompromiseAreas.trim() ? <p className="mt-1 text-sm">Never cut: {plan.noCompromiseAreas}</p> : null}</Card>}

    <Card className="print-card" data-testid="pack-dated-plan"><h2 className="font-serif text-3xl">Your dated plan</h2><div className="mt-3 space-y-4"><AiDraftLabel plan={plan} edit="none" /><DatedPlanView weddingDate={plan.weddingDate} readOnly /></div></Card>

    {venues.length > 0 && <Card className="print-card" data-testid="pack-venues"><h2 className="font-serif text-3xl">Your venue shortlist</h2><p className="mt-2 text-sm text-charcoal/70">The kinds of venue you picked, with what to ask each one.</p><div className="mt-3 grid gap-3">{venues.map(venue => <div key={venue.id} className="rounded-2xl bg-ivory p-4"><p className="font-semibold">{venue.name}</p><p className="mt-1 text-sm">Ask about: {venue.ask.join(', ')}.</p></div>)}</div></Card>}

    {questions.length > 0 && !nothingYet && <Card className="print-card" data-testid="pack-questions"><h2 className="font-serif text-3xl">Questions to settle next</h2><p className="mt-2 text-sm text-charcoal/70">Worked out from your answers by fixed rules. Not a person, and not AI.</p><ol className="mt-3 grid list-decimal gap-2 pl-5 text-sm leading-6">{questions.map(q => <li key={q.id}><span className="font-semibold">{q.question}</span> {q.why}</li>)}</ol></Card>}

    {(design.use.length > 0 || design.avoid.length > 0) && <Card className="print-card" data-testid="pack-design"><h2 className="font-serif text-3xl">Look and feel</h2>{design.use.length > 0 && <p className="mt-3 text-sm leading-6">Tell your vendors: {design.use.join(' · ')}.</p>}{design.avoid.length > 0 && <p className="mt-1 text-sm leading-6">Ask them to avoid: {design.avoid.join(' · ')}.</p>}</Card>}

    {vendors.length > 0 && <Card className="print-card" data-testid="pack-vendors"><h2 className="font-serif text-3xl">Who you need to hire, and what to ask</h2><div className="mt-3 grid gap-3">{vendors.map(vendor => <div key={vendor.name} className="rounded-2xl bg-ivory p-4"><p className="font-semibold">{vendor.name}</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{vendor.questions.map(question => <li key={question}>{question}</li>)}</ul></div>)}</div></Card>}

    {risks.length > 0 && <Card className="print-card" data-testid="pack-risks"><h2 className="font-serif text-3xl">Check before you sign anything</h2><ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{risks.map(risk => <li key={risk}>{risk}</li>)}</ul></Card>}

    {ideas.length > 0 && <Card className="print-card" data-testid="pack-ideas"><h2 className="font-serif text-3xl">Standout ideas you picked</h2><div className="mt-3 grid gap-3">{ideas.map(t => <div key={t.id} className="rounded-2xl bg-ivory p-4"><p className="font-semibold">{t.name}</p><p className="mt-1 text-sm">{t.description}</p><p className="mt-2 text-xs text-charcoal/60">Who does it: {t.vendorType}. {t.plannerWarning}</p></div>)}</div></Card>}

    {!nothingYet && <Card className="print-card" data-testid="pack-fees"><h2 className="font-serif text-3xl">Fees to ask every vendor about</h2><p className="mt-3 text-sm leading-6">{hiddenFeeChecklist.join(' · ')}</p></Card>}

    {!nothingYet && <Card className="print-card" data-testid="pack-letter"><h2 className="font-serif text-3xl">A first email to a venue or vendor</h2><p className="mt-3 whitespace-pre-line rounded-2xl bg-ivory p-4 text-sm leading-7">{letter}</p></Card>}

    <p className="text-xs leading-5 text-charcoal/60" data-testid="pack-disclaimer">{disclaimers.cost} {disclaimers.professional}</p>
    <p className="hidden text-xs print:block" data-testid="pack-print-foot">Made free at weddingchecklistpdf.com</p>
    <FullPlanCard />
  </div></EmailAsk>;
}
