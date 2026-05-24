'use client';

import { useEffect, useState } from 'react';
import { Card, Badge } from '@/components/Card';
import { PrintButton } from '@/components/PrintButton';
import { trends } from '@/data/trends';
import { disclaimers } from '@/data/disclaimers';
import { chooseScope } from '@/data/inspiration';
import { range } from '@/lib/format';
import { budgetModes, budgetReality, designDirection, emptyPlan, estimateRange, hiddenFeeChecklist, plannerBucketsForPacket, plannerLanguage, planningConstraintSummary, protectedPriorities, riskChecklist, selectedVenues, selectedVendors, vendorCategories, venueExamples, visionTranslatorOutput, type WeddingPlan } from '@/data/planning';

interface SavedScope { category?: string; description?: string; scopeTitle?: string; tableCount?: string; }

export default function PackPage() {
  const [plan, setPlan] = useState<WeddingPlan>(emptyPlan);
  const [scope, setScope] = useState<SavedScope>({});

  useEffect(() => {
    const saved = localStorage.getItem('dwb-plan');
    if (saved) setPlan({ ...emptyPlan, ...JSON.parse(saved) });
    const savedScope = localStorage.getItem('dwb-scope');
    if (savedScope) setScope(JSON.parse(savedScope));
  }, []);

  const estimate = estimateRange(plan);
  const displayEstimate = estimate.low && estimate.high ? range(estimate.low, estimate.high) : 'Not estimated yet';
  const mode = budgetModes.find(item => item.id === plan.budgetMode)?.title || 'Budget unknown';
  const translator = visionTranslatorOutput(plan);
  const selectedTrendItems = trends.filter(t => plan.selectedTrends.includes(t.id));
  const venues = selectedVenues(plan);
  const vendors = selectedVendors(plan);
  const protectedItems = protectedPriorities(plan);
  const chosenScope = chooseScope(`${scope.category || ''} ${scope.description || plan.inspirationScopeNotes || ''}`);
  const recommendation = plan.recommendationResult;

  return <div className="space-y-6">
    <section className="no-print flex items-start justify-between gap-4"><div><Badge>Printable Planner Packet</Badge><h1 className="mt-4 font-serif text-5xl">Dream Wedding Working Brief</h1><p className="mt-3 max-w-3xl text-charcoal/70">Planner-ready packet with constraint profile, Recommendation Studio output, venue/lodging strategy, budget tradeoffs, design direction, photo/description scope, vendor questions, risk checks, and verification caveats.</p></div><PrintButton /></section>

    <Card className="print-card"><h2 className="font-serif text-4xl">Planning Reality Check / Constraint Profile</h2><p className="mt-3 rounded-2xl bg-ivory p-4 text-sm font-semibold">{planningConstraintSummary(plan)}</p><div className="mt-4 grid gap-3 md:grid-cols-3"><p><strong>Mode:</strong><br />{plan.constraintMode || 'Not selected'}</p><p><strong>Location:</strong><br />{plan.locations || 'Not selected yet'}</p><p><strong>Guest count:</strong><br />{plan.guestCount || 'Unknown'}</p><p><strong>Season/date:</strong><br />{plan.season || 'Unknown'}</p><p><strong>Full buyout:</strong><br />{plan.fullBuyout || 'Unknown'}</p><p><strong>Onsite sleeping:</strong><br />{plan.onsiteSleepCount || plan.onsiteLodging || 'Unknown'}</p><p><strong>Outside catering:</strong><br />{plan.outsideCatering || 'Unknown'}</p><p><strong>Vendor freedom:</strong><br />{plan.vendorFreedom || 'Unknown'}</p><p><strong>Estimated total:</strong><br />{displayEstimate}</p></div><p className="mt-4 rounded-2xl bg-ivory p-4 text-sm"><strong>Fixed:</strong> {plan.fixedItems || 'Not captured yet'}<br /><strong>Flexible:</strong> {plan.flexibleItems || 'Not captured yet'}<br /><strong>Unknown:</strong> {plan.unknownItems || 'Not captured yet'}</p></Card>

    <Card className="print-card"><h2 className="font-serif text-4xl">Recommendation Studio</h2>{recommendation ? <div className="mt-4 grid gap-4"><p><strong>Question:</strong> {plan.recommendationQuestion}</p><p className="rounded-2xl bg-ivory p-4"><strong>Planner read:</strong> {recommendation.plannerRead}</p><div className="grid gap-4 md:grid-cols-2"><div><strong>Best-fit directions</strong><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{recommendation.bestFitDirections.map(item => <li key={item}>{item}</li>)}</ul></div><div><strong>Constraint conflicts</strong><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{recommendation.constraintConflicts.map(item => <li key={item}>{item}</li>)}</ul></div><div><strong>Budget implications</strong><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{recommendation.budgetImplications.map(item => <li key={item}>{item}</li>)}</ul></div><div><strong>Vendor questions / next decisions</strong><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{[...recommendation.vendorQuestions, ...recommendation.nextDecisionChecklist].map(item => <li key={item}>{item}</li>)}</ul></div></div><p className="rounded-2xl bg-ivory p-4 text-sm"><strong>Confidence:</strong> {recommendation.confidence}. Recommendation Studio uses saved constraints + seeded planner heuristics, not live venue or vendor data.</p></div> : <p className="mt-3 rounded-2xl bg-ivory p-4">No Recommendation Studio output saved yet.</p>}</Card>

    <Card className="print-card"><h2 className="font-serif text-4xl">Protected Priorities + Budget Reality</h2><p className="mt-3"><strong>Protect what matters:</strong> {protectedItems.length ? protectedItems.join(' · ') : 'Top three priorities not selected yet'}.</p><p className="mt-3"><strong>Budget mode:</strong> {mode}</p><p className="mt-3 rounded-2xl bg-ivory p-4 text-sm">{budgetReality(plan)}</p><p className="mt-3"><strong>Areas willing to save:</strong> {plan.saveAreas || 'Not selected yet'}</p><p className="mt-2"><strong>Never compromise:</strong> {plan.noCompromiseAreas || 'Not selected yet'}</p></Card>

    <Card className="print-card"><h2 className="font-serif text-4xl">Venue + Lodging Shortlist Strategy</h2><p className="mt-3 rounded-2xl bg-ivory p-4 text-sm">User-selected venue strategies are carried forward. No live venue availability is claimed.</p>{venues.length ? <div className="mt-4 grid gap-3">{venues.map(venue => <div key={venue.id} className="rounded-2xl bg-ivory p-4"><strong>{venue.name}</strong><p className="mt-1 text-sm">{venue.location} · {venue.venueType} · {venue.estimatedAllIn}</p><p className="mt-2 text-xs text-charcoal/60">{venue.sourceLabel}. Confidence: {venue.confidence}. Verify: {venue.verify.join(', ')}.</p></div>)}</div> : <div className="mt-4 grid gap-3">{venueExamples.slice(0, 3).map(venue => <div key={venue.id} className="rounded-2xl bg-ivory p-4"><strong>{venue.name}</strong><p className="mt-1 text-sm">{venue.location} · {venue.venueType}</p><p className="mt-2 text-xs text-charcoal/60">Example only until selected and verified.</p></div>)}</div>}</Card>

    <Card className="print-card"><h2 className="font-serif text-4xl">Design Direction</h2><p className="mt-3 leading-7">{translator.summary}</p><p className="mt-3 rounded-2xl bg-ivory p-4 text-sm">{designDirection(plan)}</p><div className="mt-4 grid gap-4 md:grid-cols-3"><p><strong>Use with vendors:</strong><br />{translator.useWords.join(' · ')}</p><p><strong>Words to avoid:</strong><br />{translator.avoidWords.join(' · ')}</p><p><strong>Implications:</strong><br />{translator.implications.join(' · ')}</p></div></Card>

    <Card className="print-card"><h2 className="font-serif text-4xl">Photo / Description Scope</h2><p className="mt-3"><strong>Selected scope:</strong> {scope.scopeTitle || chosenScope.title || 'Not analyzed yet'} · <strong>Category:</strong> {scope.category || 'Unknown'} · <strong>Table count:</strong> {scope.tableCount || 'Unknown'}</p><p className="mt-3 rounded-2xl bg-ivory p-4 text-sm"><strong>Description:</strong> {scope.description || plan.inspirationScopeNotes || 'No description saved yet.'}</p><div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-2xl bg-ivory p-4"><strong>{chosenScope.title}</strong><p className="mt-1 text-sm">{chosenScope.vendorsNeeded.join(' · ')}</p><p className="mt-2 text-xs text-charcoal/60">Confidence: {chosenScope.confidence}. Exact pricing, vendor fit, product match, and availability require verification.</p></div><div className="rounded-2xl bg-ivory p-4"><strong>Inquiry starter</strong><p className="mt-2 text-sm">{chosenScope.inquiryStarter}</p></div></div></Card>

    <Card className="print-card"><h2 className="font-serif text-4xl">Vendor Focus + Inquiry Questions</h2><p className="mt-2 rounded-2xl bg-ivory p-4 text-sm">User-selected vendor focus areas are listed first. Specific vendor names, pricing, availability, and fit must be sourced and verified.</p><div className="mt-4 grid gap-3 md:grid-cols-2">{(vendors.length ? vendors : vendorCategories.slice(0, 6)).map(vendor => <div key={vendor.name} className="rounded-2xl bg-ivory p-4"><strong>{vendor.name}</strong><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{vendor.questions.map(question => <li key={question}>{question}</li>)}</ul></div>)}</div></Card>

    <Card className="print-card"><h2 className="font-serif text-4xl">Risk / Reality Checklist</h2><ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{riskChecklist(plan).map(risk => <li key={risk}>{risk}</li>)}</ul><p className="mt-4 rounded-2xl bg-ivory p-4 text-sm">Estimated costs are planning estimates only. Venue, vendor, floral, decor, rental, attire, product, travel, and hospitality data must be directly verified before booking or purchasing.</p></Card>

    <Card className="print-card"><h2 className="font-serif text-4xl">Selected Standout Ideas</h2>{selectedTrendItems.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{selectedTrendItems.map(t => <div key={t.id} className="rounded-2xl bg-ivory p-4"><strong>{t.name}</strong><p className="mt-1 text-sm">{t.description}</p><p className="mt-2 text-sm"><strong>Cost:</strong> {t.costRange} · <strong>Vendor:</strong> {t.vendorType}</p><p className="mt-2 text-xs text-charcoal/60">{t.plannerWarning}</p></div>)}</div> : <p className="mt-3 rounded-2xl bg-ivory p-4">No standout ideas selected yet.</p>}</Card>

    <Card className="print-card"><h2 className="font-serif text-4xl">Full Planner Bucket Map</h2><p className="mt-3 text-sm text-charcoal/70">These are the buckets Recommendation Studio can reason across using the saved Constraint Profile.</p><div className="mt-4 grid gap-2 md:grid-cols-2">{plannerBucketsForPacket().map(bucket => <p key={bucket} className="rounded-2xl bg-ivory p-3 text-sm font-semibold">{bucket}</p>)}</div></Card>

    <Card className="print-card"><h2 className="font-serif text-4xl">Hidden Fee Checklist</h2><p className="mt-3 text-sm leading-6">{hiddenFeeChecklist.join(' · ')}</p></Card>

    <Card className="print-card"><h2 className="font-serif text-4xl">Vendor Inquiry Draft</h2><p className="mt-3 whitespace-pre-line rounded-2xl bg-ivory p-4 text-sm leading-7">Hi [Vendor Name],{`\n\n`}I’m exploring a wedding in {plan.locations || '[location not finalized yet]'} for approximately {plan.guestCount || '[guest count unknown]'} guests. Our current constraint profile is: {planningConstraintSummary(plan)}.{`\n\n`}Our design direction is: {plannerLanguage(plan)}{`\n\n`}Could you please share availability, starting pricing, what is included, what is commonly extra, minimum spend, service charges/taxes, setup/teardown access, insurance requirements, rain-plan implications, overtime fees, required vendors, and whether these constraints are feasible?</p></Card>

    <Card className="print-card page-break"><h2 className="font-serif text-4xl">Required Disclaimers</h2><div className="mt-4 grid gap-3 text-sm leading-6">{Object.entries(disclaimers).map(([k, v]) => <p key={k}><strong className="capitalize">{k}:</strong> {v}</p>)}<p><strong>Venue/vendor/product data:</strong> Venue, vendor, floral, decor, rental, attire, and product data must be directly verified. This packet does not guarantee pricing, availability, contract terms, exact product match, or vendor suitability and is not a substitute for a professional wedding planner.</p></div></Card>
  </div>;
}
