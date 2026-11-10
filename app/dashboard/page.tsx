'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Badge } from '@/components/Card';
import { trends } from '@/data/trends';
import { loadSavedPlan } from '@/lib/saved-plan';
import { DatedPlanView } from '@/components/DatedPlanView';
import { AiDraftLabel } from '@/components/AiDraftCard';
import { budgetReality, emptyPlan, planSummary, riskChecklist, selectedVenues, selectedVendors, venueMatchSummary, type WeddingPlan } from '@/data/planning';

// The saved plan at a glance. It shows only what she filled in or picked; an empty
// section is one plain line, never an example.
export default function DashboardPage() {
  const [plan, setPlan] = useState<WeddingPlan>(emptyPlan);

  useEffect(() => {
    const load = () => setPlan(loadSavedPlan(localStorage));
    load();
    window.addEventListener('dwb-updated', load);
    return () => window.removeEventListener('dwb-updated', load);
  }, []);

  const ideas = trends.filter(t => plan.selectedTrends.includes(t.id));
  const venues = selectedVenues(plan);
  const vendors = selectedVendors(plan);
  const risks = riskChecklist(plan);

  return <div className="mx-auto max-w-3xl space-y-6">
    <section>
      <Badge>Your plan</Badge>
      <h1 className="mt-4 font-serif text-5xl">Your wedding plan at a glance</h1>
      <p className="mt-3 text-charcoal/70">What you have saved in this browser so far. No account needed.</p>
      <div className="mt-4 flex flex-wrap gap-3"><Link className="inline-flex min-h-11 items-center rounded-2xl bg-blue px-5 py-3 font-bold text-white" href="/free-wedding-planner">Open the free wedding planner ›</Link><Link className="inline-flex min-h-11 items-center rounded-2xl border-2 border-charcoal bg-white px-5 py-3 font-bold" href="/pack">Open your plan to print ›</Link></div>
    </section>

    <Card data-testid="dashboard-dated-plan"><h2 className="font-serif text-3xl">Your dated plan</h2><div className="mt-3 space-y-4"><AiDraftLabel plan={plan} edit="planner" /><DatedPlanView weddingDate={plan.weddingDate} compact /></div><Link className="mt-3 inline-flex min-h-11 items-center font-bold underline underline-offset-4" href="/free-wedding-planner#your-date">Change the date ›</Link></Card>

    <Card data-testid="dashboard-state"><h2 className="font-serif text-3xl">The basics</h2><p className="mt-3 leading-7">{planSummary(plan)}</p><Link className="mt-2 inline-flex min-h-11 items-center font-bold underline underline-offset-4" href="/free-wedding-planner#step-0">Edit the basics ›</Link></Card>

    <Card data-testid="dashboard-budget"><h2 className="font-serif text-3xl">Budget</h2><p className="mt-3 leading-7">{budgetReality(plan)}</p><Link className="mt-2 inline-flex min-h-11 items-center font-bold underline underline-offset-4" href="/free-wedding-planner#step-3">Edit your budget ›</Link></Card>

    <Card data-testid="dashboard-venues"><h2 className="font-serif text-3xl">Venue shortlist</h2>{venues.length ? <div className="mt-3 grid gap-3">{venues.map(venue => <div key={venue.id} className="rounded-2xl bg-white p-4"><p className="font-semibold">{venue.name}</p><p className="mt-1 text-sm text-charcoal/70">Ask about: {venue.ask.join(', ')}.</p></div>)}</div> : <p className="mt-3 text-sm">No venue type picked yet. {venueMatchSummary(plan)}</p>}<Link className="mt-2 inline-flex min-h-11 items-center font-bold underline underline-offset-4" href="/free-wedding-planner#step-2">See venue types that fit ›</Link></Card>

    <Card data-testid="dashboard-vendors"><h2 className="font-serif text-3xl">Who you need to hire</h2>{vendors.length ? <div className="mt-3 grid gap-3">{vendors.map(vendor => <div key={vendor.name} className="rounded-2xl bg-white p-4"><p className="font-semibold">{vendor.name}</p><ul className="mt-2 list-disc pl-5 text-sm">{vendor.questions.map(q => <li key={q}>{q}</li>)}</ul></div>)}</div> : <p className="mt-3 text-sm">No vendors picked yet.</p>}</Card>

    {risks.length > 0 && <Card data-testid="dashboard-risk"><h2 className="font-serif text-3xl">Check before you sign anything</h2><ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{risks.map(risk => <li key={risk}>{risk}</li>)}</ul></Card>}

    {ideas.length > 0 && <Card data-testid="dashboard-ideas"><h2 className="font-serif text-3xl">Standout ideas you picked</h2><div className="mt-3 grid gap-3">{ideas.map(trend => <div key={trend.id} className="rounded-2xl bg-white p-4"><p className="font-semibold">{trend.name}</p><p className="mt-1 text-sm">{trend.description}</p></div>)}</div></Card>}
  </div>;
}
