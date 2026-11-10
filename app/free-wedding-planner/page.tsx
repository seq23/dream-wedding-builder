'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Card, Badge } from '@/components/Card';
import { TrendCard } from '@/components/TrendCard';
import { trends } from '@/data/trends';
import { disclaimers } from '@/data/disclaimers';
import { money } from '@/lib/format';
import {
  budgetModes,
  budgetReality,
  designSummary,
  emptyPlan,
  priorityOptions,
  protectedPriorities,
  readinessBreakdown,
  riskChecklist,
  selectedVenues,
  selectedVendors,
  vendorCategories,
  venueExamples,
  venueMatchSummary,
  visionQuestions,
  type WeddingPlan
} from '@/data/planning';
import { budgetHeadline, budgetPlan, budgetSubline } from '@/lib/budget-plan';
import { rankVenueTypes } from '@/lib/venue-fit';
import { nextQuestions } from '@/lib/next-questions';
import { applySeed, planPatchFromSeed, seedFieldLabels } from '@/lib/planner-seed';
import { loadSavedPlan, savePlan } from '@/lib/saved-plan';
import { plainDate } from '@/lib/dated-plan';
import { DatedPlanView } from '@/components/DatedPlanView';
import { FullPlanCard } from '@/components/FullPlanCard';
import { AiDraftCard, AiDraftLabel } from '@/components/AiDraftCard';
import { StepFold } from '@/components/StepFold';

// One job per screen (hostile review, 10 Nov 2026): the sentence or the date, the
// dated plan, the offer. The detail steps sit below, closed, and open one at a time.
// Their #step-N ids are linked from every site's banner and from seeded guide links,
// so the ids stay even though the visible numbering starts at 1.
const visionKeyMap = { feeling: 'feelings', setting: 'settings', formality: 'formality', florals: 'florals', food: 'food', photos: 'photos', avoid: 'avoids' } as const;
const visionLabels: Record<keyof typeof visionKeyMap, string> = { feeling: 'Feeling', setting: 'Setting', formality: 'How formal', florals: 'Flowers', food: 'Food', photos: 'Photos', avoid: 'Not for us' };
const PRESSURE_ORDER = { Low: 0, Medium: 1, High: 2 } as const;
const STEP_CLASS = 'grid grid-cols-[minmax(0,1fr)] gap-4 border-t border-charcoal/10 pt-5';
const INPUT = 'min-h-11 w-full min-w-0 rounded-2xl border border-charcoal/20 bg-white p-3 text-base font-normal';

function updateArray(list: string[], value: string) {
  return list.includes(value) ? list.filter(item => item !== value) : [...list, value];
}

function testIdFrom(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function PillButton({ active, children, onClick, testId }: { active: boolean; children: React.ReactNode; onClick: () => void; testId?: string }) {
  return <button data-testid={testId} type="button" aria-pressed={active} onClick={onClick} className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? 'border-charcoal bg-charcoal text-linen' : 'border-charcoal/20 bg-white text-charcoal hover:border-charcoal/40'}`}>{active ? '✓ ' : ''}{children}</button>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid min-w-0 gap-2 text-sm font-semibold">{label}{children}</label>;
}

function TextInput({ testId, value, onChange, placeholder, inputMode }: { testId?: string; value: string; onChange: (value: string) => void; placeholder: string; inputMode?: 'numeric' | 'text' }) {
  return <input data-testid={testId} value={value} inputMode={inputMode} onChange={event => onChange(event.target.value)} placeholder={placeholder} className={INPUT} />;
}

function TextArea({ testId, value, onChange, placeholder }: { testId?: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <textarea data-testid={testId} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className={`${INPUT} min-h-24`} />;
}

function StepHeader({ number, title, sub }: { number: number; title: string; sub: string }) {
  return <div><p className="font-mono text-xs uppercase tracking-[.12em] text-charcoal/60">Step {number}</p><h3 className="mt-1 font-serif text-2xl">{title}</h3><p className="mt-1 text-sm text-charcoal/65">{sub}</p></div>;
}

function More({ summary, children, testId }: { summary: string; children: React.ReactNode; testId?: string }) {
  return <details data-testid={testId} className="rounded-2xl border border-charcoal/15 bg-white p-4"><summary className="min-h-11 cursor-pointer content-center text-sm font-bold">{summary}</summary><div className="mt-3 grid gap-4">{children}</div></details>;
}

function BuildPage() {
  const [plan, setPlan] = useState<WeddingPlan>(emptyPlan);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<{ status: 'idle' | 'saved' | 'failed'; at: string }>({ status: 'idle', at: '' });
  const firstSave = useRef(true);
  const [seedReport, setSeedReport] = useState<{ applied: (keyof WeddingPlan)[]; skipped: (keyof WeddingPlan)[] } | null>(null);

  // Mount does two things in one pass: restore the saved plan, then let any seed
  // in the URL fill the fields the saved plan left empty. Order matters - seeding
  // a restored plan is what makes "never lose the reader's work" true rather than
  // aspirational. Every step is individually guarded: a corrupt localStorage blob
  // or a malformed query string leaves the planner exactly as it renders with no
  // URL and no history, because a broken inbound link is not the reader's problem.
  useEffect(() => {
    let restored: WeddingPlan = loadSavedPlan(localStorage);
    try {
      const patch = planPatchFromSeed(window.location.search.replace(/^\?/, ''));
      const result = applySeed(restored, patch);
      restored = result.plan;
      const named = (fields: (keyof WeddingPlan)[]) => fields.filter(field => seedFieldLabels[field]);
      if (named(result.applied).length || named(result.skipped).length) setSeedReport({ applied: named(result.applied), skipped: named(result.skipped) });
    } catch { /* an unreadable seed is dropped; the planner still opens */ }
    // A date typed before this page finished loading is in the field but not yet in
    // the plan: keep it rather than blanking the field she just filled.
    const typed = (document.getElementById('wedding-date') as HTMLInputElement | null)?.value ?? '';
    if (typed && !restored.weddingDate) restored = { ...restored, weddingDate: typed };
    setPlan(restored);
    setLoaded(true);
  }, []);

  // Every change saves itself. There is no Save button to find: reload, the back
  // button and the printed plan all read what this effect wrote. The first run only
  // writes back what was just restored, so it says nothing.
  useEffect(() => {
    if (!loaded) return;
    const ok = savePlan(localStorage, plan);
    window.dispatchEvent(new Event('dwb-updated'));
    if (firstSave.current) { firstSave.current = false; if (ok) return; }
    setSaveState({ status: ok ? 'saved' : 'failed', at: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) });
  }, [plan, loaded]);

  const budget = useMemo(() => budgetPlan(plan), [plan]);
  const ranking = useMemo(() => rankVenueTypes(plan, venueExamples), [plan]);
  const questions = useMemo(() => nextQuestions(plan), [plan]);
  const basics = readinessBreakdown(plan);
  const chosenTrends = trends.filter(trend => plan.selectedTrends.includes(trend.id));
  const chosenVenues = selectedVenues(plan);
  const chosenVendors = selectedVendors(plan);
  const protectedItems = protectedPriorities(plan);
  const design = designSummary(plan);
  const risks = riskChecklist(plan);
  const lowCostFirst = budget.hard || plan.budgetMode === 'range';
  // Six ideas, cheapest first when she has a number to keep to; destination-weekend
  // ideas only for a destination wedding. Anything she already picked stays on show.
  const standoutIdeas = useMemo(() => {
    const pool = trends.filter(trend => ranking.wants.destination || trend.category !== 'Destination / Weekend Wow Moments');
    const ordered = lowCostFirst ? [...pool].sort((a, b) => PRESSURE_ORDER[a.budgetPressure ?? 'Medium'] - PRESSURE_ORDER[b.budgetPressure ?? 'Medium']) : pool;
    const picked = trends.filter(trend => plan.selectedTrends.includes(trend.id));
    return [...picked, ...ordered.filter(trend => !plan.selectedTrends.includes(trend.id))].slice(0, Math.max(6, picked.length));
  }, [plan.selectedTrends, ranking.wants.destination, lowCostFirst]);

  // The planner renders only on weddingchecklistpdf.com; the three sibling products
  // are linked at their own host so the click is not a cross-host 308.
  const workingFiles = [
    { id: 'checklist-pdf', name: 'Wedding Checklist PDF', price: 9, route: '/products/checklist-pdf', reason: 'A 104-row checklist file you fill in, with a printable packet. Your dates from this page are not carried into it.' },
    { id: 'budget-spreadsheet', name: 'Wedding Budget Spreadsheet', price: 12, route: 'https://weddingbudgetspreadsheet.com/products/budget-spreadsheet', reason: budget.budget ? `A spreadsheet for tracking your ${money(Math.min(budget.budget, budget.limit))} against quotes, deposits and the fees venues leave off.` : 'A spreadsheet for tracking quotes, deposits and the fees venues leave off.' },
    { id: 'timeline-template', name: 'Wedding Timeline Template', price: 12, route: 'https://weddingtimelinetemplate.com/products/timeline-template', reason: 'The wedding day itself, hour by hour, with vendor arrival and pack-up times.' },
    { id: 'seating-chart-maker', name: 'Wedding Seating Chart Maker', price: 19, route: 'https://weddingseatingchartmaker.com/products/seating-chart-maker', reason: budget.guests ? `Your ${budget.guests} guests arranged into tables.` : 'Your guests arranged into tables, once you know the count.' }
  ];

  const patch = (partial: Partial<WeddingPlan>) => setPlan(current => ({ ...current, ...partial }));
  const toggle = (key: keyof WeddingPlan, value: string) => setPlan(current => ({ ...current, [key]: updateArray(current[key] as string[], value) }));
  const toggleTrend = (id: string) => patch({ selectedTrends: updateArray(plan.selectedTrends, id) });
  const toggleVenue = (id: string) => patch({ selectedVenueIds: updateArray(plan.selectedVenueIds, id) });
  const toggleVendor = (name: string) => patch({ selectedVendorCategories: updateArray(plan.selectedVendorCategories, name) });
  const select = (value: string, onChange: (value: string) => void, options: [string, string][], testId?: string) => <select data-testid={testId} value={value} onChange={event => onChange(event.target.value)} className={INPUT}><option value="">Not decided yet</option>{options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>;

  return <div className="mx-auto max-w-3xl space-y-8 pb-24">
    {seedReport && <section data-testid="seed-notice" className="rounded-[12px] border border-charcoal/15 bg-white p-5 text-sm leading-6">
      <p className="font-mono text-xs uppercase tracking-[.12em] text-charcoal/60">Started from the page you came from</p>
      {seedReport.applied.length > 0 && <p className="mt-2 font-semibold" data-testid="seed-applied">Filled in for you: {seedReport.applied.map(field => seedFieldLabels[field] ?? String(field)).join(', ')}.</p>}
      {seedReport.skipped.length > 0 && <p className="mt-2 font-semibold text-charcoal/70" data-testid="seed-skipped">Kept your saved answers for: {seedReport.skipped.map(field => seedFieldLabels[field] ?? String(field)).join(', ')}. A link can never overwrite work you already entered.</p>}
      <p className="mt-2 text-xs text-charcoal/60">These are example starting values, not quotes. Change any of them below.</p>
    </section>}

    <header>
      <Badge>Free wedding planner</Badge>
      <h1 className="mt-4 font-serif text-[40px] leading-[42px] md:text-6xl md:leading-tight">Build the wedding around reality, not generic inspiration.</h1>
      <p data-testid="planner-promise" className="mt-4 text-lg leading-8 text-charcoal/70">No account, no app and no email needed to see your plan. Add your date and your dated checklist is on this page; it saves in this browser by itself.</p>
    </header>

    <StepFold id="your-date" defaultOpen className="grid grid-cols-[minmax(0,1fr)] gap-4" label="section" header={<div><h2 className="font-serif text-3xl">Your dated plan.</h2><p className="mt-1 text-sm text-charcoal/65">Every task, placed on your calendar.</p></div>}>
      <Card data-testid="wedding-date-card">
        <label className="grid gap-2 text-sm font-semibold" htmlFor="wedding-date">Wedding date
          <input id="wedding-date" data-testid="wedding-date" type="date" value={plan.weddingDate} onChange={event => patch({ weddingDate: event.target.value })} className="min-h-11 max-w-xs rounded-2xl border border-charcoal/20 bg-white p-3 text-base" />
        </label>
        <p className="mt-2 text-xs text-charcoal/60">Not sure yet? Pick your best guess; you can change it any time. Saved in this browser only.</p>
        <div className="mt-5 space-y-4"><AiDraftLabel plan={plan} /><DatedPlanView weddingDate={plan.weddingDate} /></div>
        {plan.weddingDate ? <FullPlanCard /> : null}
      </Card>
    </StepFold>

    <AiDraftCard plan={plan} onApply={next => { setPlan(next); requestAnimationFrame(() => document.getElementById('your-date')?.scrollIntoView({ block: 'start' })); }} />

    <Card className="bg-white" data-testid="canonical-plan-summary">
      <p className="font-mono text-xs uppercase tracking-[.12em] text-charcoal/60">Your plan so far</p>
      <p className="mt-3 text-sm text-charcoal/65">Your budget</p>
      <p data-testid="guided-total" className="font-serif text-4xl [overflow-wrap:anywhere]">{budgetHeadline(plan)}</p>
      <p data-testid="budget-subline" className="mt-1 text-sm text-charcoal/70">{budgetSubline(plan)}</p>
      {budget.warnings.length > 0 && <p data-testid="budget-warning" role="status" className="mt-3 rounded-2xl border border-red-pen/40 bg-white p-3 text-sm leading-6 text-red-pen">{budget.warnings[0]} <a href="#step-3" className="font-bold underline underline-offset-4">Open your budget ▾</a></p>}
      <dl className="mt-4 grid gap-1 text-sm">
        {([['Date', plan.weddingDate ? plainDate(plan.weddingDate) : '', '#your-date'], ['Guests', plan.guestCount, '#step-0'], ['Place', plan.locations, '#step-0']] as const).map(([label, value, href]) => <div key={label} className="flex items-baseline justify-between gap-3 border-b border-charcoal/10 py-2">
          <dt className="text-charcoal/60">{label}</dt>
          <dd className="min-w-0 text-right font-semibold [overflow-wrap:anywhere]">{value || <a href={href} className="font-bold text-blue underline underline-offset-4">Add ›</a>}</dd>
        </div>)}
      </dl>
      <p data-testid="plan-readiness" className="mt-3 text-sm text-charcoal/70">{basics.filter(check => check.satisfied).length} of {basics.length} basics answered. <Link href="/readiness-score" className="font-bold underline underline-offset-4">How this is counted ›</Link></p>
      <p data-testid="save-status" role="status" className={`mt-3 text-sm font-semibold ${saveState.status === 'failed' ? 'text-red-pen' : 'text-done'}`}>{saveState.status === 'failed' ? 'This browser is not letting us save (private window?). Print your plan before you close the page.' : saveState.status === 'saved' ? `Saved in this browser ✓ ${saveState.at}` : 'Saves in this browser by itself as you type.'}</p>
      <Link href="/pack" data-testid="open-packet" className="mt-4 flex min-h-12 items-center justify-center rounded-2xl border-2 border-charcoal bg-white px-5 py-3 text-center font-bold">Open your plan to print ›</Link>
    </Card>

    <section aria-labelledby="details-heading" className="space-y-5">
      <div><h2 id="details-heading" className="font-serif text-3xl">Plan the details.</h2><p className="mt-1 text-sm text-charcoal/65">Seven short steps, one open at a time. Skip any of them; your dated plan above does not depend on them.</p></div>

      <StepFold id="step-0" group="details" className={STEP_CLASS} header={<StepHeader number={1} title="The basics" sub="Where, how many, and what matters most." />}>
        <Card data-testid="constraint-profile" className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-2" data-testid="constraint-fields">
            <Field label="Town or area"><TextInput testId="location-input" value={plan.locations} onChange={locations => patch({ locations })} placeholder="Memphis, Charleston, not sure yet" /></Field>
            <Field label="How many guests"><TextInput testId="guest-input" value={plan.guestCount} onChange={guestCount => patch({ guestCount })} placeholder="120, or 70-80" /></Field>
            <Field label="Season or month"><TextInput testId="season-input" value={plan.season} onChange={season => patch({ season })} placeholder="October 2027, spring, flexible" /></Field>
            <Field label="Indoors or outdoors, and anything else you picture"><TextInput testId="wishes-input" value={plan.outdoorNeeds} onChange={outdoorNeeds => patch({ outdoorNeeds })} placeholder="Outdoor ceremony, live band, taco bar" /></Field>
          </div>
          <div data-testid="protected-priorities">
            <p className="text-sm font-semibold">What matters most? Your first three are the last things to cut.</p>
            <div className="mt-3 flex flex-wrap gap-2">{priorityOptions.map(option => <PillButton key={option} testId={`priority-${testIdFrom(option)}`} active={plan.priorities.includes(option)} onClick={() => toggle('priorities', option)}>{option}</PillButton>)}</div>
            {protectedItems.length > 0 && <p className="mt-3 text-sm text-charcoal/70">Your first three: {protectedItems.join(', ')}.</p>}
          </div>
          <More summary="Venue rules you already know (optional)" testId="hard-constraint-detail">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Other places you would consider"><TextInput value={plan.backupLocations} onChange={backupLocations => patch({ backupLocations })} placeholder="Nashville, anywhere within two hours" /></Field>
              <Field label="The whole venue to yourselves">{select(plan.fullBuyout, fullBuyout => patch({ fullBuyout }), [['required', 'Must have'], ['preferred', 'Would like'], ['not required', 'Not needed']], 'full-buyout')}</Field>
              <Field label="Guests sleeping at the venue">{select(plan.onsiteLodging, onsiteLodging => patch({ onsiteLodging }), [['required', 'Must have'], ['preferred', 'Would like'], ['vip only', 'Family only'], ['not required', 'Nearby hotels are fine']], 'onsite-lodging')}</Field>
              <Field label="How many would sleep there"><TextInput testId="onsite-sleep-count" value={plan.onsiteSleepCount} onChange={onsiteSleepCount => patch({ onsiteSleepCount })} placeholder="20 rooms, family only" /></Field>
              <Field label="Bringing your own caterer">{select(plan.outsideCatering, outsideCatering => patch({ outsideCatering }), [['required', 'Must have'], ['preferred', 'Would like'], ['venue catering ok', 'The venue’s caterer is fine']], 'outside-catering')}</Field>
              <Field label="Bringing your own drinks"><TextInput value={plan.outsideBar} onChange={outsideBar => patch({ outsideBar })} placeholder="Must have, would like, not important" /></Field>
              <Field label="Rain plan"><TextInput testId="rain-backup" value={plan.rainBackup} onChange={rainBackup => patch({ rainBackup })} placeholder="Indoor room, tent, not sure yet" /></Field>
              <Field label="How late the party runs"><TextInput value={plan.curfewFlexibility} onChange={curfewFlexibility => patch({ curfewFlexibility })} placeholder="Dancing until midnight, early night is fine" /></Field>
              <Field label="Access needs"><TextInput value={plan.accessibilityNeeds} onChange={accessibilityNeeds => patch({ accessibilityNeeds })} placeholder="No stairs, close parking, older relatives" /></Field>
              <Field label="Food needs"><TextInput value={plan.culturalFoodNeeds} onChange={culturalFoodNeeds => patch({ culturalFoodNeeds })} placeholder="Kosher, halal, vegetarian, family recipes" /></Field>
            </div>
            <Field label="Anything that cannot change"><TextArea testId="fixed-items" value={plan.fixedItems} onChange={fixedItems => patch({ fixedItems })} placeholder="The date, the church, Grandma must be able to attend" /></Field>
          </More>
        </Card>
      </StepFold>

      <StepFold id="step-1" group="details" className={STEP_CLASS} header={<StepHeader number={2} title="Questions to settle next" sub="Worked out from your answers by fixed rules. Not a person, and not AI." />}>
        <Card data-testid="next-questions">
          {questions.length ? <ol className="grid gap-3">{questions.map((q, index) => <li key={q.id} data-testid={`next-question-${q.id}`} className="rounded-2xl bg-ivory p-4">
            <p className="font-semibold">{index + 1}. {q.question}</p>
            <p className="mt-1 text-sm leading-6 text-charcoal/75">Why: {q.why}</p>
            <a href={q.href} className="mt-1 inline-flex min-h-11 items-center text-sm font-bold text-blue underline underline-offset-4">Settle it ▾</a>
          </li>)}</ol> : <p className="rounded-2xl bg-ivory p-4 font-semibold text-done">Nothing open: every question this list knows how to ask has an answer.</p>}
          <p className="mt-4 text-xs leading-5 text-charcoal/60">This list changes as you fill in the steps. It reads only what you typed on this page.</p>
        </Card>
      </StepFold>

      <StepFold id="step-2" group="details" className={STEP_CLASS} header={<StepHeader number={3} title="Venue types that fit" sub="Kinds of venue to ask about, sorted by what you told us." />}>
        <Card data-testid="venue-finder">
          <p data-testid="venue-match-summary" className="rounded-2xl bg-ivory p-4 text-sm font-semibold">{venueMatchSummary(plan)}</p>
          <div className="mt-4 grid gap-4" data-testid="venue-cards">{ranking.shown.map(({ venue, level, reasons }) => {
            const active = plan.selectedVenueIds.includes(venue.id);
            return <div key={venue.id} data-testid={`venue-${venue.id}`} data-fit={level} className={`rounded-2xl border p-4 ${active ? 'border-charcoal bg-ivory' : 'border-charcoal/15 bg-white'}`}>
              {ranking.basis.length > 0 && <Badge tone={level === 'fits' ? 'success' : 'neutral'}>{level === 'fits' ? 'Fits what you told us' : 'Worth a look, with a catch'}</Badge>}
              <h4 className="mt-2 font-serif text-2xl">{venue.name}</h4>
              <p className="mt-1 text-sm text-charcoal/70">{venue.goodFor}</p>
              {reasons.length > 0 && <p className="mt-2 text-sm">Why: {reasons.join('. ')}.</p>}
              <p className="mt-2 text-sm text-charcoal/70">Ask each one about: {venue.ask.join(', ')}.</p>
              <button type="button" data-testid={`select-venue-${venue.id}`} aria-pressed={active} onClick={() => toggleVenue(venue.id)} className="mt-3 min-h-11 w-full rounded-2xl border border-charcoal/25 bg-white px-4 py-2 text-sm font-bold">{active ? '✓ On your shortlist (tap to remove)' : '+ Add to your shortlist'}</button>
            </div>;
          })}</div>
          {ranking.hidden.length > 0 && <p data-testid="venue-hidden" className="mt-4 text-sm leading-6 text-charcoal/70">Left out: {ranking.hidden.map(item => `${item.venue.name} (${item.reason})`).join('; ')}.</p>}
          <div data-testid="selected-venue-summary" className="mt-4 rounded-2xl bg-ivory p-4 text-sm font-semibold">Your shortlist: {chosenVenues.length ? chosenVenues.map(v => v.name).join(' · ') : 'Not decided yet'}</div>
          <p className="mt-3 text-xs leading-5 text-charcoal/60">These are kinds of venue, not named venues, and sizes are typical for the kind. Nothing here checks prices or open dates.</p>
        </Card>
      </StepFold>

      <StepFold id="step-3" group="details" className={STEP_CLASS} header={<StepHeader number={4} title="Budget" sub="Your number, split across the wedding." />}>
        <Card data-testid="budget-reality" className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Total budget"><TextInput testId="budget-target" inputMode="text" value={plan.budgetTarget} onChange={budgetTarget => patch({ budgetTarget })} placeholder="$30,000" /></Field>
            <Field label="Hard limit, if different"><TextInput testId="hard-ceiling" inputMode="text" value={plan.hardCeiling} onChange={hardCeiling => patch({ hardCeiling })} placeholder="The number you cannot pass" /></Field>
          </div>
          <div>
            <p className="text-sm font-semibold">How firm is it?</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">{budgetModes.map(mode => <button type="button" key={mode.id} data-testid={`budget-${mode.id}`} aria-pressed={plan.budgetMode === mode.id} onClick={() => patch({ budgetMode: mode.id })} className={`min-h-11 rounded-2xl border p-3 text-left text-sm ${plan.budgetMode === mode.id ? 'border-charcoal bg-charcoal text-linen' : 'border-charcoal/20 bg-white'}`}><span className="font-bold">{plan.budgetMode === mode.id ? '✓ ' : ''}{mode.title}</span></button>)}</div>
          </div>
          <p data-testid="budget-message" className="rounded-2xl bg-ivory p-4 text-sm leading-6">{budgetReality(plan)}</p>
          {budget.lines.length > 0 && <div data-testid="budget-split">
            <p className="text-sm font-semibold">A starting split of {money(Math.min(budget.budget, budget.limit))}</p>
            <ul className="mt-2 grid gap-1 text-sm">{budget.lines.map(line => <li key={line.id} data-testid={`budget-line-${line.id}`} className="flex items-baseline justify-between gap-3 border-b border-charcoal/10 py-2"><span>{line.label}{line.yours ? ' (your number)' : ''}{line.protectedLine ? ' · matters most' : ''}</span><span className="font-mono font-semibold">{money(line.amount)}</span></li>)}</ul>
            <p className="mt-2 text-xs leading-5 text-charcoal/60">A starting point to edit, not a price list: it leans toward what you said matters most. Your quotes replace these numbers.</p>
          </div>}
          <More summary="Your own numbers and what to cut first (optional)" testId="budget-own-lines">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Venue, food and drink"><TextInput testId="venue-budget" value={plan.venueBudget} onChange={venueBudget => patch({ venueBudget })} placeholder="$14,000" /></Field>
              <Field label="Photos and video"><TextInput testId="photo-budget" value={plan.photoVideoBudget} onChange={photoVideoBudget => patch({ photoVideoBudget })} placeholder="$3,000" /></Field>
              <Field label="Flowers, decor and rentals"><TextInput testId="floral-budget" value={plan.floralDecorBudget} onChange={floralDecorBudget => patch({ floralDecorBudget })} placeholder="$3,000" /></Field>
              <Field label="Clothes, hair and make-up"><TextInput value={plan.fashionBudget} onChange={fashionBudget => patch({ fashionBudget })} placeholder="$2,000" /></Field>
              <Field label="Guest comfort and transport"><TextInput value={plan.hospitalityBudget} onChange={hospitalityBudget => patch({ hospitalityBudget })} placeholder="$1,500" /></Field>
            </div>
            <Field label="What you would cut first"><TextArea testId="save-areas" value={plan.saveAreas} onChange={saveAreas => patch({ saveAreas })} placeholder="Favours, printed programmes, late-night snacks" /></Field>
            <Field label="What you would never cut"><TextArea value={plan.noCompromiseAreas} onChange={noCompromiseAreas => patch({ noCompromiseAreas })} placeholder="Good food, the photographer" /></Field>
          </More>
        </Card>
      </StepFold>

      <StepFold id="step-4" group="details" className={STEP_CLASS} header={<StepHeader number={5} title="Look and feel" sub="Words you can hand to a florist, a venue or a photographer." />}>
        <Card data-testid="vibe-translator" className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="How it should feel, in your words"><TextArea testId="own-vibe-input" value={plan.ownVibeWords} onChange={ownVibeWords => patch({ ownVibeWords })} placeholder="Relaxed backyard party, string lights, good music" /></Field>
            <Field label="How it should not feel"><TextArea value={plan.avoidFeelingLike} onChange={avoidFeelingLike => patch({ avoidFeelingLike })} placeholder="Stiff, formal, too themed" /></Field>
            <Field label="Colours you love"><TextInput testId="colors-loved" value={plan.colorsLoved} onChange={colorsLoved => patch({ colorsLoved })} placeholder="Burnt orange, cream, green" /></Field>
            <Field label="Colours to avoid"><TextInput value={plan.colorsAvoided} onChange={colorsAvoided => patch({ colorsAvoided })} placeholder="No neon, no burgundy" /></Field>
          </div>
          <More summary="Pick from a list instead (optional)">
            {Object.entries(visionQuestions).map(([rawKey, values]) => {
              const key = rawKey as keyof typeof visionKeyMap;
              const planKey = visionKeyMap[key];
              return <div key={key}><p className="text-sm font-semibold">{visionLabels[key]}</p><div className="mt-2 flex flex-wrap gap-2">{values.filter(value => value !== 'not sure yet').map(value => <PillButton key={value} active={(plan[planKey] as string[]).includes(value)} onClick={() => toggle(planKey, value)}>{value}</PillButton>)}</div></div>;
            })}
          </More>
          {(design.use.length > 0 || design.avoid.length > 0) && <div data-testid="vibe-translator-output" className="rounded-2xl bg-ivory p-4 text-sm leading-6">
            {design.use.length > 0 && <p>Tell your vendors: {design.use.join(' · ')}.</p>}
            {design.avoid.length > 0 && <p>Ask them to avoid: {design.avoid.join(' · ')}.</p>}
          </div>}
        </Card>
      </StepFold>

      <StepFold id="step-5" group="details" className={STEP_CLASS} header={<StepHeader number={6} title="Vendors and what to ask" sub="Pick who you need to hire; their questions go on your printed plan." />}>
        <Card data-testid="vendor-map">
          <div className="grid gap-3">{vendorCategories.map(vendor => { const active = plan.selectedVendorCategories.includes(vendor.name); return <div key={vendor.name} className={`rounded-2xl border p-4 ${active ? 'border-charcoal bg-ivory' : 'border-charcoal/15 bg-white'}`}>
            <h4 className="font-serif text-xl">{vendor.name}</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-charcoal/75">{vendor.questions.map(question => <li key={question}>{question}</li>)}</ul>
            <button type="button" data-testid={`select-vendor-${testIdFrom(vendor.name)}`} aria-pressed={active} onClick={() => toggleVendor(vendor.name)} className="mt-3 min-h-11 w-full rounded-2xl border border-charcoal/25 bg-white px-4 py-2 text-sm font-bold">{active ? '✓ On your list (tap to remove)' : '+ Add to your list'}</button>
          </div>; })}</div>
          <div data-testid="selected-vendor-summary" className="mt-4 rounded-2xl bg-ivory p-4 text-sm font-semibold">Your list: {chosenVendors.length ? chosenVendors.map(v => v.name).join(' · ') : 'Not decided yet'}</div>
        </Card>
      </StepFold>

      <StepFold id="step-6" group="details" className={STEP_CLASS} header={<StepHeader number={7} title="Standout ideas" sub="Optional extras. Nothing is added until you add it." />}>
        <div className="grid gap-4" data-testid="standout-ideas">
          {lowCostFirst && <p data-testid="ideas-order-note" className="text-sm text-charcoal/70">Lowest-cost ideas first, because you have a number to keep to.</p>}
          {standoutIdeas.map(trend => <Card key={trend.id} className="shadow-none"><TrendCard trend={trend} compact /><button type="button" data-testid={`toggle-trend-${trend.id}`} aria-pressed={plan.selectedTrends.includes(trend.id)} onClick={() => toggleTrend(trend.id)} className="mt-3 min-h-11 w-full rounded-2xl border border-charcoal/25 bg-white px-4 py-2 text-sm font-bold">{plan.selectedTrends.includes(trend.id) ? '✓ In your plan (tap to remove)' : '+ Add to your plan'}</button></Card>)}
          <p className="text-sm font-semibold">In your plan: {chosenTrends.length ? chosenTrends.map(t => t.name).join(' · ') : 'none yet'}</p>
          <Link href="/trends" className="inline-flex min-h-11 items-center font-bold text-blue underline underline-offset-4">See every standout idea ›</Link>
        </div>
      </StepFold>
    </section>

    <section id="step-7" data-testid="step-pack" className="scroll-mt-24 rounded-[12px] border border-charcoal/15 bg-white p-5">
      <h2 className="font-serif text-3xl">Your plan, ready to print.</h2>
      <p className="mt-2 text-sm leading-6 text-charcoal/70">Your dated tasks, your budget, your shortlist and the questions for each vendor on one printable page. It shows only what you filled in.</p>
      {risks.length > 0 && <div data-testid="risk-reality-check" className="mt-4 rounded-2xl bg-ivory p-4 text-sm"><p className="font-semibold">Check before you sign anything</p><ul className="mt-2 list-disc space-y-1 pl-5">{risks.map(risk => <li key={risk}>{risk}</li>)}</ul></div>}
      <Link href="/pack" className="mt-4 flex min-h-12 items-center justify-center rounded-2xl border-2 border-charcoal bg-white px-5 py-3 text-center font-bold">Open your plan to print ›</Link>
    </section>

    {/* Every paid file is reachable from here, each saying plainly what it is. */}
    <section className="rounded-[12px] border border-charcoal/10 bg-white p-5" data-testid="planner-working-files"><h2 className="font-serif text-3xl">When the plan stops changing</h2><p className="mt-2 text-sm leading-6 text-charcoal/70">Files you can edit and hand to other people. All optional: this planner is free and stays free.</p>
      <div className="mt-4 grid gap-3">{workingFiles.map(file => <a key={file.id} data-testid={`planner-product-${file.id}`} href={file.route} className="rounded-2xl border border-charcoal/10 bg-ivory p-4 transition hover:bg-linen"><span className="block font-bold">{file.name} — ${file.price} ›</span><span className="mt-1 block text-sm leading-6 text-charcoal/65">{file.reason}</span></a>)}</div>
      <Link href="/shop" className="mt-4 inline-flex min-h-11 items-center font-bold underline underline-offset-4">Compare the four wedding planning tools and prices ›</Link>
    </section>

    <p data-testid="planner-disclaimer" className="text-xs leading-5 text-charcoal/60">{disclaimers.cost} Venue types and ideas here are examples to ask about; no live prices or availability are shown. {disclaimers.professional}</p>
  </div>;
}

// No wall: the plan opens for everyone (owner, 10 Nov 2026). An email is asked only
// where it buys her something: the free AI draft and the printable plan.
export default function PlannerPage() {
  return <BuildPage />;
}
