'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, Badge } from '@/components/Card';
import { TrendCard } from '@/components/TrendCard';
import { StickyTotal } from '@/components/StickyTotal';
import { trends } from '@/data/trends';
import { disclaimers } from '@/data/disclaimers';
import { range } from '@/lib/format';
import {
  budgetModes,
  budgetReality,
  derivePlanReadiness,
  emptyPlan,
  estimateRange,
  hiddenFeeChecklist,
  inspirationCategories,
  inspirationTemplates,
  intelligenceModules,
  plannerLanguage,
  planningStages,
  scopeComponents,
  vendorCategories,
  venueExamples,
  visionQuestions,
  visionTranslatorOutput,
  type WeddingPlan
} from '@/data/planning';
import { chooseScope, inspirationScopes, tableCountFromPlan } from '@/data/inspiration';

const stepLabels = ['Intake', 'Vibe Translator', 'Budget Reality', 'Venue Finder', 'Photo/Description Scope', 'Vendors', 'Trends', 'Brief'];
const priorityOptions = ['Venue', 'Food + Bar', 'Photography', 'Florals', 'Guest Comfort', 'Family Ease', 'Party Energy', 'Budget Control', 'Travel/Lodging', 'Cultural Traditions', 'Fashion', 'Rain Plan'];
const visionKeyMap = { feeling: 'feelings', setting: 'settings', formality: 'formality', florals: 'florals', food: 'food', photos: 'photos', avoid: 'avoids' } as const;

function updateArray(list: string[], value: string) {
  return list.includes(value) ? list.filter(item => item !== value) : [...list, value];
}

function PillButton({ active, children, onClick, testId }: { active: boolean; children: React.ReactNode; onClick: () => void; testId?: string }) {
  return <button data-testid={testId} type="button" onClick={onClick} className={`rounded-full border px-4 py-2 text-sm font-bold transition ${active ? 'border-charcoal bg-charcoal text-linen' : 'border-charcoal/10 bg-white text-charcoal hover:border-charcoal/40'}`}>{children}</button>;
}

function Trace({ label, confidence = 'Medium' }: { label: string; confidence?: string }) {
  return <p className="mt-2 rounded-2xl bg-white/70 px-3 py-2 text-xs font-semibold text-charcoal/65">Trace: {label} · Confidence: {confidence} · Verify before booking or purchasing.</p>;
}

export default function BuildPage() {
  const [plan, setPlan] = useState<WeddingPlan>(emptyPlan);
  const [fileName, setFileName] = useState('');
  const [photoConsent, setPhotoConsent] = useState(false);
  const [photoAnalyzed, setPhotoAnalyzed] = useState(false);
  const [scopeCategory, setScopeCategory] = useState('tablescape');
  const [scopeDescription, setScopeDescription] = useState('');

  const readiness = derivePlanReadiness(plan);
  const chosenTrends = trends.filter(trend => plan.selectedTrends.includes(trend.id));
  const budgetMessage = budgetReality(plan);
  const brief = plannerLanguage(plan);
  const translator = visionTranslatorOutput(plan);
  const estimate = estimateRange(plan);
  const displayEstimate = estimate.low && estimate.high ? range(estimate.low, estimate.high) : 'Not estimated yet';
  const selectedScope = useMemo(() => chooseScope(scopeCategory || scopeDescription), [scopeCategory, scopeDescription]);

  const patch = (partial: Partial<WeddingPlan>) => setPlan(current => ({ ...current, ...partial }));
  const toggle = (key: keyof WeddingPlan, value: string) => setPlan(current => ({ ...current, [key]: updateArray(current[key] as string[], value) }));
  const applyTemplate = (name: string) => patch({ selectedTemplate: plan.selectedTemplate === name ? '' : name });
  const toggleTrend = (id: string) => patch({ selectedTrends: updateArray(plan.selectedTrends, id) });

  const savePlan = () => {
    const saved = { ...plan, inspirationScopeNotes: scopeDescription || plan.inspirationScopeNotes, generatedAt: new Date().toISOString() };
    localStorage.setItem('dwb-plan', JSON.stringify(saved));
    localStorage.setItem('dwb-trends', JSON.stringify(chosenTrends));
    localStorage.setItem('dwb-scope', JSON.stringify({ category: scopeCategory, description: scopeDescription, scopeTitle: selectedScope.title, tableCount: tableCountFromPlan(plan) }));
    window.dispatchEvent(new Event('dwb-updated'));
  };

  return <div className="space-y-10 pb-24">
    <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <Badge>Master rebuild · bride-led planning intelligence</Badge>
        <h1 className="mt-4 max-w-4xl font-serif text-5xl leading-tight md:text-7xl">Start with your words, photos, or uncertainty. Convert it into planner-grade decisions.</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-charcoal/70">This builder includes Tablescape Decoder, Bouquet + Floral Scope, and Flower Girl Dress Finder modules and accepts blank-state brides, messy vibe language, uploaded inspiration, descriptions, budgets, locations, and unknowns. It labels confidence, scopes costs, maps vendors, and refuses fake certainty.</p>
        <div className="mt-6 flex flex-wrap gap-2" aria-label="Planner steps">{stepLabels.map((label, index) => <a key={label} href={`#step-${index}`} className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow-soft">Step {index}: {label}</a>)}</div>
        <div className="mt-6 grid gap-2 md:grid-cols-2" data-testid="master-plan-modules">{intelligenceModules.map(module => <p key={module} className="rounded-2xl bg-white p-3 text-sm font-bold">{module}</p>)}</div>
      </div>
      <Card className="sticky top-6 h-fit" data-testid="canonical-plan-summary">
        <p className="text-xs uppercase tracking-[0.3em] text-charcoal/50">Canonical plan state</p>
        <p data-testid="guided-total" className="mt-2 font-serif text-4xl">{displayEstimate}</p>
        <p className="mt-2 text-sm text-charcoal/70">{plan.locations || 'Location not selected'} · {plan.guestCount || 'Guest count unknown'} guests · {budgetModes.find(m => m.id === plan.budgetMode)?.title || 'Budget unknown'}</p>
        <div className="mt-5 grid gap-2 text-sm"><p><strong>Readiness:</strong> {readiness}%</p><p><strong>Selected trends:</strong> {chosenTrends.length}</p><p><strong>Venue/vendor data:</strong> seeded examples and user input only. No live venue availability. No live vendor availability.</p></div>
        <Trace label="User input + seeded planning benchmarks + inspiration scope" confidence="Low until verified" />
        <button data-testid="save-guided-plan" onClick={savePlan} className="mt-6 w-full rounded-full bg-charcoal px-5 py-4 font-bold text-linen">Save this working plan</button>
        <Link href="/pack" className="mt-3 block rounded-full border border-charcoal/20 bg-white px-5 py-4 text-center font-bold">Open planner packet</Link>
      </Card>
    </section>

    <section id="step-0" className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Step 0</Badge><h2 className="mt-3 font-serif text-3xl">Tell us what you know.</h2><p className="mt-2 text-sm text-charcoal/65">A bride can be early, unsure, or overwhelmed. Unknown is a valid answer.</p></div>
      <Card data-testid="step-intake"><h3 className="font-serif text-4xl">Where are you in planning?</h3><div className="mt-5 grid gap-3 md:grid-cols-2">{planningStages.map(stage => <button key={stage} type="button" onClick={() => patch({ stage })} className={`rounded-2xl border p-4 text-left font-semibold ${plan.stage === stage ? 'border-charcoal bg-charcoal text-linen' : 'border-charcoal/10 bg-white'}`}>{stage}</button>)}</div><div className="mt-6 grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">Location or locations you are considering<input data-testid="location-input" value={plan.locations} onChange={event => patch({ locations: event.target.value })} placeholder="Example: Charleston, Napa, Chicago, not sure yet" className="rounded-2xl border border-charcoal/10 bg-white p-3" /></label><label className="grid gap-2 text-sm font-semibold">Guest count or range<input data-testid="guest-input" value={plan.guestCount} onChange={event => patch({ guestCount: event.target.value })} placeholder="Example: 80-100, 150, not sure" className="rounded-2xl border border-charcoal/10 bg-white p-3" /></label><label className="grid gap-2 text-sm font-semibold">Season or date range<input value={plan.season} onChange={event => patch({ season: event.target.value })} placeholder="Spring 2027, fall, flexible" className="rounded-2xl border border-charcoal/10 bg-white p-3" /></label><label className="grid gap-2 text-sm font-semibold">Family, cultural, accessibility, or stress constraints<input value={plan.constraints} onChange={event => patch({ constraints: event.target.value })} placeholder="Family pressure, cultural ceremony, mobility needs, no idea" className="rounded-2xl border border-charcoal/10 bg-white p-3" /></label></div></Card>
    </section>

    <section id="step-1" className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Step 1</Badge><h2 className="mt-3 font-serif text-3xl">Vibe + Theme Translator.</h2><p className="mt-2 text-sm text-charcoal/65">Accepts the bride's own verbiage, photos, descriptions, or guided prompts. Presets are inspiration only.</p></div>
      <Card data-testid="step-vision"><h3 className="font-serif text-4xl">Describe the feeling in your own words, upload inspiration, or choose helper language.</h3><div className="mt-5 grid gap-4"><label className="grid gap-2 text-sm font-semibold">Your messy wording<textarea data-testid="own-vibe-input" value={plan.ownVibeWords} onChange={event => patch({ ownVibeWords: event.target.value })} placeholder="Example: candlelit garden dinner party, elegant but not stiff, not rustic, great food, soft and expensive-feeling" className="min-h-28 rounded-2xl border border-charcoal/10 bg-white p-3" /></label><label className="grid gap-2 text-sm font-semibold">Photo / Pinterest / inspiration notes<textarea data-testid="inspiration-notes" value={plan.inspirationNotes} onChange={event => patch({ inspirationNotes: event.target.value })} placeholder="Example: bouquet photo is soft pink and ivory, tablescape has lace linens and taper candles, flower girl dresses have bows" className="min-h-24 rounded-2xl border border-charcoal/10 bg-white p-3" /></label></div><div className="mt-6 grid gap-6">{Object.entries(visionQuestions).map(([key, values]) => <div key={key}><p className="mb-2 text-xs font-bold uppercase tracking-wide text-charcoal/50">{key}</p><div className="flex flex-wrap gap-2">{values.map(value => <PillButton key={value} active={(plan[visionKeyMap[key as keyof typeof visionKeyMap]] as string[]).includes(value)} onClick={() => toggle(visionKeyMap[key as keyof typeof visionKeyMap], value)}>{value}</PillButton>)}</div></div>)}</div><Card className="mt-6 bg-ivory shadow-none" data-testid="vibe-translator-output"><Badge>Planner speak translation</Badge><h4 className="mt-3 font-serif text-3xl">{translator.direction}</h4><p className="mt-3 leading-7">{translator.summary}</p><div className="mt-4 grid gap-4 md:grid-cols-3"><div><strong>Use with vendors</strong><p className="mt-2 text-sm text-charcoal/70">{translator.useWords.join(' · ')}</p></div><div><strong>Words to avoid</strong><p className="mt-2 text-sm text-charcoal/70">{translator.avoidWords.join(' · ')}</p></div><div><strong>Implications</strong><p className="mt-2 text-sm text-charcoal/70">{translator.implications.join(' · ')}</p></div></div><Trace label="Interpreted from bride wording/photos/prompts" confidence="Medium until confirmed" /></Card></Card>
    </section>

    <section id="step-2" className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Step 2</Badge><h2 className="mt-3 font-serif text-3xl">Budget reality.</h2><p className="mt-2 text-sm text-charcoal/65">No fake dream total. Budget can be unknown, hard, flexible, or dream-first.</p></div>
      <Card data-testid="budget-reality"><h3 className="font-serif text-4xl">Set your reality range.</h3><div className="mt-5 grid gap-3 md:grid-cols-2">{budgetModes.map(mode => <button key={mode.id} data-testid={`budget-${mode.id}`} onClick={() => patch({ budgetMode: mode.id })} className={`rounded-2xl border p-4 text-left ${plan.budgetMode === mode.id ? 'border-charcoal bg-charcoal text-linen' : 'border-charcoal/10 bg-white'}`}><strong>{mode.title}</strong><p className="mt-1 text-sm opacity-75">{mode.copy}</p></button>)}</div><div className="mt-6 grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">Total wedding budget comfort<input data-testid="budget-target" value={plan.budgetTarget} onChange={event => patch({ budgetTarget: event.target.value })} placeholder="Example: 65000, unknown, flexible" className="rounded-2xl border border-charcoal/10 bg-white p-3" /></label><label className="grid gap-2 text-sm font-semibold">Venue / food-bar budget comfort<input value={plan.venueBudget} onChange={event => patch({ venueBudget: event.target.value })} placeholder="Example: 35000 or not sure" className="rounded-2xl border border-charcoal/10 bg-white p-3" /></label></div><p className="mt-5 rounded-2xl bg-ivory p-4 font-semibold">{budgetMessage}</p><Trace label="Budget math from guest count + user budget + benchmark ranges" confidence="Low/Medium" /></Card>
    </section>

    <section id="step-3" className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Step 3</Badge><h2 className="mt-3 font-serif text-3xl">Venue Finder / Matchmaker.</h2><p className="mt-2 text-sm text-charcoal/65">Location + budget-aware venue intelligence, not fake all-venue omniscience.</p></div>
      <Card data-testid="venue-finder"><Badge>Venue Finder / Matchmaker</Badge><h3 className="mt-3 font-serif text-4xl">Find venue strategy from location, budget, guest count, and style.</h3><p className="mt-3 text-charcoal/70">The LLM/data layer should rank, explain, warn, and generate inquiry actions from structured data. This UI is not inventing live prices or availability.</p><div className="mt-5 grid gap-4 md:grid-cols-3">{venueExamples.map(venue => <Card key={venue.id} className="shadow-none"><Badge tone={venue.budgetFit.includes('Strong') ? 'success' : venue.budgetFit.includes('Stretch') || venue.budgetFit.includes('not') ? 'warning' : 'neutral'}>{venue.budgetFit}</Badge><h4 className="mt-3 font-serif text-2xl">{venue.name}</h4><p className="mt-2 text-sm text-charcoal/70">{venue.location} · {venue.venueType} · {venue.capacity}</p><p className="mt-3 font-bold">{venue.estimatedAllIn}</p><p className="mt-3 text-xs text-charcoal/60">{venue.sourceLabel}. Confidence: {venue.confidence}. Verify: {venue.verify.join(', ')}.</p></Card>)}</div><Trace label="Seeded venue-type examples until real venue dataset/API/admin CSV exists" confidence="Low" /></Card>
    </section>

    <section id="step-4" className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Step 4</Badge><h2 className="mt-3 font-serif text-3xl">Photo/Description-to-Scope Intelligence.</h2><p className="mt-2 text-sm text-charcoal/65">Tablescapes, bouquets, flowers, flower girl dresses, attire, stationery, decor, and typed descriptions all get the same structured treatment.</p></div>
      <Card data-testid="scope-intelligence"><Badge>Photo/Description-to-Scope Intelligence</Badge><h3 className="mt-3 font-serif text-4xl">Upload or describe anything. Price the scope, vendors, and verification path.</h3><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">What are we scoping?<select data-testid="scope-category" value={scopeCategory} onChange={event => setScopeCategory(event.target.value)} className="rounded-2xl border border-charcoal/10 bg-white p-3">{inspirationCategories.map(cat => <option key={cat}>{cat}</option>)}</select></label><label className="grid gap-2 text-sm font-semibold">Upload inspiration photo<input data-testid="photo-input" type="file" accept="image/*" onChange={event => setFileName(event.target.files?.[0]?.name || '')} className="rounded-2xl border border-dashed border-charcoal/20 bg-white p-3" /></label></div>{fileName && <p className="mt-3 font-semibold">Selected image: {fileName}</p>}<label className="mt-5 grid gap-2 text-sm font-semibold">Or describe it in your own words<textarea data-testid="scope-description" value={scopeDescription} onChange={event => setScopeDescription(event.target.value)} placeholder="Example: long tables with lace cloths, candles everywhere, soft pink flowers, bows on chairs, maybe chandeliers" className="min-h-28 rounded-2xl border border-charcoal/10 bg-white p-3" /></label><div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm"><strong>Photo analysis notice:</strong> To analyze photos later, images may be sent to a third-party visual/search provider. No fake live vendor/product search is claimed. Results are planning estimates only and may be wrong. Exact pricing, vendor fit, product match, and availability require verification.</div><label className="mt-4 flex gap-2 text-sm"><input data-testid="photo-consent" type="checkbox" checked={photoConsent} onChange={event => setPhotoConsent(event.target.checked)} /> I understand and want to analyze this photo/description.</label><button data-testid="analyze-photo" disabled={(!fileName && !scopeDescription.trim()) || !photoConsent} onClick={() => { setPhotoAnalyzed(true); patch({ inspirationScopeNotes: scopeDescription }); }} className="mt-4 rounded-full bg-charcoal px-6 py-3 font-bold text-linen disabled:opacity-40">Analyze scope</button>{photoAnalyzed && <Card className="mt-6 bg-ivory shadow-none" data-testid="photo-results"><Badge>{selectedScope.title}</Badge><h4 className="mt-3 font-serif text-3xl">Scope estimate, vendor map, and verification checklist</h4><p className="mt-2 text-sm text-charcoal/70">{selectedScope.intakePrompt}</p><div className="mt-5 grid gap-4 md:grid-cols-2"><div><strong>Missing questions</strong><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{selectedScope.missingQuestions.map(q => <li key={q}>{q}</li>)}</ul></div><div><strong>Likely table count</strong><p className="mt-2 text-sm">{tableCountFromPlan(plan)}</p><strong className="mt-4 block">Vendors likely needed</strong><p className="mt-2 text-sm">{selectedScope.vendorsNeeded.join(' · ')}</p></div></div><div className="mt-5 grid gap-3">{selectedScope.components.map(component => <div key={component.name} className="rounded-2xl bg-white p-4"><strong>{component.name}</strong><p className="mt-1 text-sm">{component.visibleStatus} · {component.quantityBasis} · {component.estimate}</p><p className="mt-2 text-xs text-charcoal/60">Vendors: {component.vendors.join(', ')}. Confidence: {component.confidence}. Verify: {component.verificationQuestions.join(' ')}</p></div>)}</div><div className="mt-5 grid gap-3 md:grid-cols-2"><div><strong>Warnings</strong><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{selectedScope.warnings.map(w => <li key={w}>{w}</li>)}</ul></div><div><strong>Inquiry starter</strong><p className="mt-2 rounded-2xl bg-white p-3 text-sm">{selectedScope.inquiryStarter}</p></div></div><Trace label="Uploaded inspiration or bride description + seeded scope benchmarks" confidence={selectedScope.confidence} /></Card>}</Card>
    </section>

    <section id="step-5" className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Step 5</Badge><h2 className="mt-3 font-serif text-3xl">Vendor intelligence.</h2><p className="mt-2 text-sm text-charcoal/65">First decide the kind of vendor needed, then source with verification.</p></div>
      <Card data-testid="vendor-map"><h3 className="font-serif text-4xl">Vendor Finder pattern for every category.</h3><div className="mt-5 grid gap-4 md:grid-cols-2">{vendorCategories.map(vendor => <Card key={vendor.name} className="shadow-none"><h4 className="font-serif text-2xl">{vendor.name}</h4><ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-charcoal/70">{vendor.questions.map(question => <li key={question}>{question}</li>)}</ul><Trace label="Vendor type guidance; specific vendors require sourced data" confidence="Medium" /></Card>)}</div></Card>
    </section>

    <section id="step-6" className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Step 6</Badge><h2 className="mt-3 font-serif text-3xl">Trends + inspiration templates.</h2><p className="mt-2 text-sm text-charcoal/65">Nothing is selected until the bride chooses it. Templates do not overwrite location, budget, or guest count.</p></div>
      <div className="space-y-6"><Card data-testid="inspiration-templates"><h3 className="font-serif text-4xl">Optional inspiration templates</h3><div className="mt-5 grid gap-4 md:grid-cols-3">{inspirationTemplates.map(template => <button type="button" key={template.name} onClick={() => applyTemplate(template.name)} className={`rounded-3xl border p-4 text-left ${plan.selectedTemplate === template.name ? 'border-charcoal bg-charcoal text-linen' : 'border-charcoal/10 bg-linen'}`}><strong>{template.name}</strong><p className="mt-2 text-sm opacity-75">Adopt: {template.adopt.join(', ')}</p><p className="mt-2 text-xs opacity-70">Does not adopt: {template.doNotAdopt.join(', ')}</p></button>)}</div><Trace label="Template is inspiration only; no active wedding state overwrite" confidence="High" /></Card><div className="grid gap-4 md:grid-cols-3">{trends.slice(0, 6).map(trend => <Card key={trend.id} className="shadow-none"><TrendCard trend={trend} /><button data-testid={`toggle-trend-${trend.id}`} onClick={() => toggleTrend(trend.id)} className="mt-3 w-full rounded-full border border-charcoal/20 bg-white px-4 py-2 text-sm font-bold">{plan.selectedTrends.includes(trend.id) ? 'Remove from working plan' : 'Add to working plan'}</button></Card>)}</div></div>
    </section>

    <section id="step-7" className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Step 7</Badge><h2 className="mt-3 font-serif text-3xl">Planner-ready brief.</h2><p className="mt-2 text-sm text-charcoal/65">Output is more valuable than intake.</p></div>
      <Card data-testid="step-pack"><h3 className="font-serif text-4xl">planner-ready working brief preview</h3><p className="mt-3 leading-7">{brief}</p><div className="mt-5 grid gap-4 md:grid-cols-3"><p><strong>Location:</strong><br />{plan.locations || 'Not selected yet'}</p><p><strong>Guest count:</strong><br />{plan.guestCount || 'Unknown'}</p><p><strong>Budget:</strong><br />{displayEstimate}</p><p><strong>Selected trends:</strong><br />{chosenTrends.length ? chosenTrends.map(t => t.name).join(', ') : 'None selected yet'}</p><p><strong>Scope module:</strong><br />{photoAnalyzed ? selectedScope.title : 'Not analyzed yet'}</p><p><strong>Hidden Fee Checklist:</strong><br />{hiddenFeeChecklist.length} items to verify</p></div><div className="mt-5 rounded-2xl bg-ivory p-4"><strong>Source trace:</strong> Chosen by user + interpreted from wording/photos + seeded estimates + verification caveats. No exact pricing, availability, or vendor claim is presented without source/confidence labels.</div><Link href="/pack" className="mt-6 inline-flex rounded-full bg-charcoal px-6 py-3 font-bold text-linen">Open full packet</Link><div className="mt-5 grid gap-3 text-sm">{Object.values(disclaimers).map(item => <p key={item} className="rounded-2xl bg-white p-3">{item}</p>)}</div></Card>
    </section>

    <section className="grid gap-4 md:grid-cols-3" data-testid="scope-components-map">{scopeComponents.map(scope => <Card key={scope.category}><Badge>{scope.category}</Badge><p className="mt-3 text-sm"><strong>Components:</strong> {scope.components.join(' · ')}</p><p className="mt-3 text-sm"><strong>Vendors:</strong> {scope.vendors.join(' · ')}</p><p className="mt-3 text-xs text-charcoal/60"><strong>Warnings:</strong> {scope.warnings.join(' · ')}</p></Card>)}</section>
    <section className="grid gap-4 md:grid-cols-4">{inspirationScopes.map(scope => <Card key={scope.title}><Badge>{scope.confidence} confidence</Badge><h3 className="mt-3 font-serif text-2xl">{scope.title}</h3><p className="mt-2 text-sm text-charcoal/70">{scope.intakePrompt}</p></Card>)}</section>

    <StickyTotal total={displayEstimate} />
  </div>;
}
