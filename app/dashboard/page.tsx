'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Badge } from '@/components/Card';
import { trends } from '@/data/trends';
import { emptyPlan, plannerLanguage, planningConstraintSummary, protectedPriorities, riskChecklist, selectedVenues, selectedVendors, venueMatchSummary, type WeddingPlan } from '@/data/planning';

interface SavedScope { category?: string; description?: string; scopeTitle?: string; tableCount?: string; }

export default function DashboardPage() {
  const [plan, setPlan] = useState<WeddingPlan>(emptyPlan);
  const [scope, setScope] = useState<SavedScope>({});

  useEffect(() => {
    const load = () => {
      const saved = localStorage.getItem('dwb-plan');
      if (saved) setPlan({ ...emptyPlan, ...JSON.parse(saved) });
      const savedScope = localStorage.getItem('dwb-scope');
      if (savedScope) setScope(JSON.parse(savedScope));
    };
    load();
    window.addEventListener('dwb-updated', load);
    return () => window.removeEventListener('dwb-updated', load);
  }, []);

  const selectedTrendItems = trends.filter(t => plan.selectedTrends.includes(t.id));
  const venues = selectedVenues(plan);
  const vendors = selectedVendors(plan);
  const protectedItems = protectedPriorities(plan);
  const recommendation = plan.recommendationResult;

  return <div className="space-y-6">
    <section>
      <Badge>Dashboard</Badge>
      <h1 className="mt-4 font-serif text-5xl">Working Wedding Dashboard</h1>
      <p className="mt-3 max-w-3xl text-charcoal/70">This page reflects saved constraints, Recommendation Studio output, selected venue strategy, selected vendor focus, photo/scope work, trends, and risks. No login required for v1.</p>
      <div className="mt-4 flex flex-wrap gap-3"><Link className="rounded-full bg-charcoal px-5 py-3 font-bold text-linen" href="/build#step-0">Edit Constraint Profile</Link><Link className="rounded-full border border-charcoal/20 bg-white px-5 py-3 font-bold" href="/build#step-1">Ask Recommendation Studio</Link></div>
    </section>

    <Card data-testid="dashboard-state"><h2 className="font-serif text-3xl">Canonical plan state</h2><p className="mt-3 leading-7">{plannerLanguage(plan)}</p><div className="mt-4 grid gap-3 md:grid-cols-3"><p><strong>Constraint mode</strong><br />{plan.constraintMode || 'Not selected'}</p><p><strong>Location</strong><br />{plan.locations || 'Location not selected'}</p><p><strong>Guest count</strong><br />{plan.guestCount ? `${plan.guestCount} guests` : 'Guest count unknown'}</p><p><strong>Budget</strong><br />{plan.budgetTarget || 'Unknown'}</p><p><strong>Full buyout</strong><br />{plan.fullBuyout || 'Unknown'}</p><p><strong>Outside catering</strong><br />{plan.outsideCatering || 'Unknown'}</p></div></Card>

    <Card data-testid="dashboard-constraints"><h2 className="font-serif text-3xl">Constraint Profile</h2><p className="mt-3 rounded-2xl bg-ivory p-4 text-sm font-semibold">{planningConstraintSummary(plan)}</p><div className="mt-4 grid gap-3 md:grid-cols-3"><p><strong>Fixed</strong><br />{plan.fixedItems || 'Not captured yet'}</p><p><strong>Flexible</strong><br />{plan.flexibleItems || 'Not captured yet'}</p><p><strong>Unknown</strong><br />{plan.unknownItems || 'Not captured yet'}</p></div></Card>

    <Card data-testid="dashboard-recommendation"><h2 className="font-serif text-3xl">Recommendation Studio</h2>{recommendation ? <div className="mt-3 space-y-3"><p><strong>Question:</strong> {plan.recommendationQuestion}</p><p className="rounded-2xl bg-ivory p-4"><strong>Planner read:</strong> {recommendation.plannerRead}</p><ul className="list-disc pl-5 text-sm">{recommendation.bestFitDirections.slice(0, 3).map(item => <li key={item}>{item}</li>)}</ul></div> : <p className="mt-3 rounded-2xl bg-ivory p-4">No recommendation saved yet. Ask Recommendation Studio when you are stumped.</p>}</Card>

    <Card data-testid="dashboard-venues"><h2 className="font-serif text-3xl">Venue + Lodging Strategy</h2><p className="mt-3 rounded-2xl bg-ivory p-4 text-sm">{venueMatchSummary(plan)}</p>{venues.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{venues.map(venue => <div key={venue.id} className="rounded-2xl bg-white p-4"><strong>{venue.name}</strong><p className="mt-1 text-sm">{venue.location} · {venue.venueType}</p><p className="mt-2 text-xs text-charcoal/60">Verify: {venue.verify.join(', ')}</p></div>)}</div> : <p className="mt-3">No venue direction selected yet.</p>}</Card>

    <Card data-testid="dashboard-budget"><h2 className="font-serif text-3xl">Budget + Protected Priorities</h2><p className="mt-3"><strong>Protected priorities:</strong> {protectedItems.length ? protectedItems.join(' · ') : 'Not selected yet'}</p><p className="mt-3"><strong>Save areas:</strong> {plan.saveAreas || 'Not selected yet'}</p><p className="mt-3"><strong>Never compromise:</strong> {plan.noCompromiseAreas || 'Not selected yet'}</p></Card>

    <Card data-testid="dashboard-scope"><h2 className="font-serif text-3xl">Photo / Description Scope</h2><p className="mt-3"><strong>Selected scope:</strong> {scope.scopeTitle || 'Not analyzed yet'}</p><p className="mt-2"><strong>Description:</strong> {scope.description || plan.inspirationScopeNotes || 'No description saved yet'}</p><p className="mt-2"><strong>Table count:</strong> {scope.tableCount || 'Unknown'}</p></Card>

    <Card data-testid="dashboard-vendors"><h2 className="font-serif text-3xl">Vendor Team + Inquiry Focus</h2>{vendors.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{vendors.map(vendor => <div key={vendor.name} className="rounded-2xl bg-white p-4"><strong>{vendor.name}</strong><ul className="mt-2 list-disc pl-5 text-sm">{vendor.questions.map(q => <li key={q}>{q}</li>)}</ul></div>)}</div> : <p className="mt-3">No vendor focus selected yet.</p>}</Card>

    <Card data-testid="dashboard-risk"><h2 className="font-serif text-3xl">Risk / Reality Checks</h2><ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{riskChecklist(plan).map(risk => <li key={risk}>{risk}</li>)}</ul></Card>

    <Card><h2 className="font-serif text-3xl">Selected Standout Ideas</h2>{selectedTrendItems.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{selectedTrendItems.map(trend => <div key={trend.id} className="rounded-2xl bg-white p-4"><strong>{trend.name}</strong><p className="mt-1 text-sm">{trend.description}</p></div>)}</div> : <p className="mt-3">No standout ideas selected yet.</p>}</Card>
  </div>;
}
