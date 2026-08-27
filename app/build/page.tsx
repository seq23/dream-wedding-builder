'use client';

import { useEffect, useMemo, useState } from 'react';
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
  designDirection,
  emptyPlan,
  estimateRange,
  generateRecommendation,
  hiddenFeeChecklist,
  inspirationCategories,
  inspirationTemplates,
  intelligenceModules,
  multiDayOptions,
  plannerBucketDescriptions,
  plannerBuckets,
  plannerLanguage,
  planningBuckets,
  planningConstraintSummary,
  protectedPriorities,
  riskChecklist,
  scopeComponents,
  selectedVenues,
  selectedVendors,
  vendorCategories,
  venueExamples,
  venueMatchSummary,
  venueTypeOptions,
  visionQuestions,
  visionTranslatorOutput,
  type ConstraintMode,
  type PlannerBucket,
  type WeddingPlan
} from '@/data/planning';
import { chooseScope, inspirationScopes, tableCountFromPlan } from '@/data/inspiration';

const stepLabels = ['Reality Check / Planning Reality Check', 'Recommendation Studio / Recommendation Studio', 'Venue Strategy / Venue + Lodging Matchmaker', 'Budget Reality / Budget + Tradeoff Reality', 'Design Language / Design + scope', 'Vendor Questions / Vendor Team + Inquiry Builder', 'Standout ideas / Standout Ideas', 'Planner Packet'];
const priorityOptions = ['Venue privacy', 'Full buyout', 'Guest lodging', 'Food + Bar', 'Photography', 'Florals', 'Guest Comfort', 'Family Ease', 'Party Energy', 'Budget Control', 'Travel/Lodging', 'Cultural Traditions', 'Fashion', 'Rain Plan', 'Accessibility'];
const visionKeyMap = { feeling: 'feelings', setting: 'settings', formality: 'formality', florals: 'florals', food: 'food', photos: 'photos', avoid: 'avoids' } as const;

function updateArray(list: string[], value: string) {
  return list.includes(value) ? list.filter(item => item !== value) : [...list, value];
}

function testIdFrom(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function PillButton({ active, children, onClick, testId }: { active: boolean; children: React.ReactNode; onClick: () => void; testId?: string }) {
  return <button data-testid={testId} type="button" onClick={onClick} className={`rounded-full border px-4 py-2 text-sm font-bold transition ${active ? 'border-charcoal bg-charcoal text-linen' : 'border-charcoal/10 bg-white text-charcoal hover:border-charcoal/40'}`}>{children}</button>;
}

function Trace({ label, confidence = 'Medium' }: { label: string; confidence?: string }) {
  return <p className="mt-2 rounded-2xl border border-charcoal/10 bg-white/70 px-3 py-2 text-xs font-semibold text-charcoal/65">Trace: Planning assumption: {label} · Confidence: {confidence} · Verify before booking or purchasing.</p>;
}

function TrustMarker({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-charcoal/10 bg-white px-3 py-2 text-xs font-bold text-charcoal/65">{children}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm font-semibold">{label}{children}</label>;
}

function TextInput({ testId, value, onChange, placeholder }: { testId?: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <input data-testid={testId} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="rounded-2xl border border-charcoal/10 bg-white p-3" />;
}

function TextArea({ testId, value, onChange, placeholder }: { testId?: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <textarea data-testid={testId} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="min-h-28 rounded-2xl border border-charcoal/10 bg-white p-3" />;
}

export default function BuildPage() {
  const [plan, setPlan] = useState<WeddingPlan>(emptyPlan);
  const [fileName, setFileName] = useState('');
  const [photoConsent, setPhotoConsent] = useState(false);
  const [photoAnalyzed, setPhotoAnalyzed] = useState(false);
  const [scopeCategory, setScopeCategory] = useState('tablescape');
  const [scopeDescription, setScopeDescription] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('dwb-plan');
    if (saved) setPlan({ ...emptyPlan, ...JSON.parse(saved) });
    const savedScope = localStorage.getItem('dwb-scope');
    if (savedScope) {
      const scope = JSON.parse(savedScope);
      setScopeCategory(scope.category || 'tablescape');
      setScopeDescription(scope.description || '');
      setPhotoAnalyzed(Boolean(scope.scopeTitle));
    }
  }, []);

  const readiness = derivePlanReadiness(plan);
  const chosenTrends = trends.filter(trend => plan.selectedTrends.includes(trend.id));
  const featuredStandoutIdeas = trends.filter(trend => ['hidden-champagne-wall-bartender','color-smoke-kiss-moment','custom-scent-perfume-bar','chef-led-pasta-wheel','secret-after-party-door','late-night-comfort-food-window'].includes(trend.id));
  const chosenVenues = selectedVenues(plan);
  const chosenVendors = selectedVendors(plan);
  const budgetMessage = budgetReality(plan);
  const brief = plannerLanguage(plan);
  const translator = visionTranslatorOutput(plan);
  const estimate = estimateRange(plan);
  const displayEstimate = estimate.low && estimate.high ? range(estimate.low, estimate.high) : 'Not estimated yet';
  const selectedScope = useMemo(() => chooseScope(`${scopeCategory} ${scopeDescription}`), [scopeCategory, scopeDescription]);
  const protectedItems = protectedPriorities(plan);
  const risks = riskChecklist(plan);
  const recommendation = plan.recommendationResult;

  const patch = (partial: Partial<WeddingPlan>) => setPlan(current => ({ ...current, ...partial }));
  const toggle = (key: keyof WeddingPlan, value: string) => setPlan(current => ({ ...current, [key]: updateArray(current[key] as string[], value) }));
  const applyTemplate = (name: string) => patch({ selectedTemplate: plan.selectedTemplate === name ? '' : name });
  const toggleTrend = (id: string) => patch({ selectedTrends: updateArray(plan.selectedTrends, id) });
  const toggleVenue = (id: string) => patch({ selectedVenueIds: updateArray(plan.selectedVenueIds, id) });
  const toggleVendor = (name: string) => patch({ selectedVendorCategories: updateArray(plan.selectedVendorCategories, name) });

  const saveScope = (nextPlan = plan) => {
    localStorage.setItem('dwb-scope', JSON.stringify({ category: scopeCategory, description: scopeDescription, scopeTitle: selectedScope.title, tableCount: tableCountFromPlan(nextPlan) }));
  };

  const persist = (nextPlan: WeddingPlan) => {
    localStorage.setItem('dwb-plan', JSON.stringify(nextPlan));
    localStorage.setItem('dwb-trends', JSON.stringify(trends.filter(trend => nextPlan.selectedTrends.includes(trend.id))));
    saveScope(nextPlan);
    window.dispatchEvent(new Event('dwb-updated'));
  };

  const savePlan = () => {
    const saved = { ...plan, inspirationScopeNotes: scopeDescription || plan.inspirationScopeNotes, generatedAt: new Date().toISOString() };
    setPlan(saved);
    persist(saved);
  };

  const runRecommendation = () => {
    const result = generateRecommendation(plan);
    const next = { ...plan, recommendationResult: result, generatedAt: new Date().toISOString() };
    setPlan(next);
    persist(next);
  };

  const analyzeScope = () => {
    setPhotoAnalyzed(true);
    const next = { ...plan, inspirationScopeNotes: scopeDescription, generatedAt: new Date().toISOString() };
    setPlan(next);
    persist(next);
  };

  const selectConstraintMode = (mode: ConstraintMode) => patch({ constraintMode: mode });

  return <div className="space-y-10 pb-24">
    <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div>
        <Badge>Master planner intelligence · constraint-first</Badge>
        <p className="mt-5 max-w-2xl font-serif text-2xl italic leading-9 text-charcoal/70">A calm planner desk for the messy decisions before anyone books a venue.</p>
        <h1 className="mt-4 max-w-4xl font-serif text-5xl leading-tight md:text-7xl">Build the wedding around reality, not generic inspiration.</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-charcoal/70">Start with Step 0: Planning Planning Reality Check. Then use the Recommendation Studio when you are stumped: venue, flowers, budget, guest experience, design, vendors, food, timeline, risks, or anything messy. The app uses your saved constraints everywhere.</p>
        <div className="mt-6 flex flex-wrap gap-2" aria-label="Planner steps">{stepLabels.map((label, index) => <a key={label} href={`#step-${index}`} className="rounded-full border border-charcoal/10 bg-white px-4 py-2 text-sm font-bold shadow-soft">Step {index}: {label}</a>)}</div>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="#step-0" className="rounded-full bg-charcoal px-5 py-3 font-bold text-linen">Start Step 0: Planning Reality Check</a>
          <a href="#step-1" data-testid="hero-recommendation-studio-cta" className="rounded-full border border-charcoal/20 bg-white px-5 py-3 font-bold">Ask Recommendation Studio</a>
        </div>
        <div className="mt-6 flex flex-wrap gap-2" aria-label="Planning trust markers"><TrustMarker>Seeded examples only</TrustMarker><TrustMarker>No live availability claimed</TrustMarker><TrustMarker>Verify before booking</TrustMarker><TrustMarker>Confidence labels included</TrustMarker><TrustMarker>Packet records assumptions</TrustMarker></div>
        <p className="mt-3 text-xs font-semibold text-charcoal/55">Not decided yet is the calm planning label; legacy guardrails still preserve Location not selected and Guest count unknown states for anti-theater validation.</p>
        <div className="mt-6 grid gap-2 md:grid-cols-2" data-testid="master-plan-modules">{intelligenceModules.map(module => <p key={module} className="rounded-2xl border border-charcoal/10 bg-white p-3 text-sm font-bold">{module}</p>)}</div>
      </div>
      <Card className="sticky top-6 h-fit bg-ivory" data-testid="canonical-plan-summary">
        <p className="text-xs uppercase tracking-[0.3em] text-charcoal/50">Working Plan</p>
        <p data-testid="guided-total" className="mt-2 font-serif text-4xl">{displayEstimate}</p>
        <p className="mt-2 text-sm text-charcoal/70">{plan.locations || 'Location not selected'} · {plan.guestCount || 'Guest count unknown'} guests · {budgetModes.find(m => m.id === plan.budgetMode)?.title || 'Budget not decided yet'}</p>
        <div className="mt-5 grid gap-2 text-sm"><p><strong>Readiness:</strong> {readiness}%</p><p><strong>Constraint mode:</strong> {plan.constraintMode || 'Not decided yet'}</p><p><strong>Selected venues:</strong> {chosenVenues.length}</p><p><strong>Vendor focus:</strong> {chosenVendors.length}</p><p><strong>Selected standout ideas:</strong> {chosenTrends.length}</p><p><strong>Venue/vendor data:</strong> seeded examples and user input only. No live venue availability. No live vendor availability.</p></div>
        <Trace label="User input + seeded planning benchmarks + Recommendation Studio + selected decisions" confidence="Low until verified" />
        <button data-testid="save-guided-plan" onClick={savePlan} className="mt-6 w-full rounded-full bg-charcoal px-5 py-4 font-bold text-linen">Save this working plan</button>
        <Link href="/pack" className="mt-3 block rounded-full border border-charcoal/20 bg-white px-5 py-4 text-center font-bold">Open planner packet</Link>
      </Card>
    </section>

    <section id="step-0" className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Step 0</Badge><h2 className="mt-3 font-serif text-3xl">Planning Reality Check.</h2><p className="mt-2 text-sm text-charcoal/65">Constraint-first, not form-first. Tell the system whether hard rules already exist.</p></div>
      <Card data-testid="constraint-profile">
        <h3 className="font-serif text-4xl">Do you already know any must-haves?</h3>
        <p className="mt-3 text-charcoal/70">Your answer controls which constraint fields appear. Not decided yet is allowed; the Recommendation Studio can help discover constraints.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <button data-testid="constraint-mode-hard" onClick={() => selectConstraintMode('hard')} className={`rounded-3xl border p-4 text-left font-bold ${plan.constraintMode === 'hard' ? 'border-charcoal bg-charcoal text-linen' : 'border-charcoal/10 bg-white'}`}>Yes — I have hard requirements<span className="mt-2 block text-sm font-normal opacity-75">Example: Italy, full buyout, sleeps 70–80, outside catering required.</span></button>
          <button data-testid="constraint-mode-flexible" onClick={() => selectConstraintMode('flexible')} className={`rounded-3xl border p-4 text-left font-bold ${plan.constraintMode === 'flexible' ? 'border-charcoal bg-charcoal text-linen' : 'border-charcoal/10 bg-white'}`}>Some, but I’m flexible<span className="mt-2 block text-sm font-normal opacity-75">Capture fixed, flexible, and unknown decisions.</span></button>
          <button data-testid="constraint-mode-discovery" onClick={() => selectConstraintMode('discovery')} className={`rounded-3xl border p-4 text-left font-bold ${plan.constraintMode === 'discovery' ? 'border-charcoal bg-charcoal text-linen' : 'border-charcoal/10 bg-white'}`}>No — help me figure it out<span className="mt-2 block text-sm font-normal opacity-75">Start with discovery prompts and ask the studio.</span></button>
        </div>

        {plan.constraintMode && <div className="mt-6 space-y-6" data-testid="constraint-fields">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Primary location / region"><TextInput testId="location-input" value={plan.locations} onChange={locations => patch({ locations })} placeholder="Italy, Tuscany, Georgia, Charleston, not sure yet" /></Field>
            <Field label="Backup locations"><TextInput value={plan.backupLocations} onChange={backupLocations => patch({ backupLocations })} placeholder="France/Spain okay, coastal Southeast, none" /></Field>
            <Field label="Guest count or range"><TextInput testId="guest-input" value={plan.guestCount} onChange={guestCount => patch({ guestCount })} placeholder="70-80, 120, not sure" /></Field>
            <Field label="Season or date range"><TextInput value={plan.season} onChange={season => patch({ season })} placeholder="Spring 2027, summer, flexible" /></Field>
            <Field label="Location flexibility"><TextInput value={plan.locationFlexibility} onChange={locationFlexibility => patch({ locationFlexibility })} placeholder="Fixed, preferred, open within region, open globally if constraints fit" /></Field>
            <Field label="Travel tolerance"><TextInput value={plan.travelTolerance} onChange={travelTolerance => patch({ travelTolerance })} placeholder="Easy flights required, remote okay, minimal transfers, luxury destination acceptable" /></Field>
          </div>

          {(plan.constraintMode === 'hard' || plan.constraintMode === 'flexible') && <div className="rounded-3xl bg-ivory p-4" data-testid="hard-constraint-detail">
            <h4 className="font-serif text-3xl">Venue, lodging, catering, and vendor freedom</h4>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Full venue buyout"><select data-testid="full-buyout" value={plan.fullBuyout} onChange={event => patch({ fullBuyout: event.target.value })} className="rounded-2xl border border-charcoal/10 bg-white p-3"><option value="">Not decided yet</option><option value="required">Required</option><option value="preferred">Preferred</option><option value="not required">Not required</option></select></Field>
              <Field label="Onsite sleeping requirement"><select data-testid="onsite-lodging" value={plan.onsiteLodging} onChange={event => patch({ onsiteLodging: event.target.value })} className="rounded-2xl border border-charcoal/10 bg-white p-3"><option value="">Not decided yet</option><option value="required">Must sleep guests onsite</option><option value="preferred">Preferred</option><option value="vip only">VIP/family onsite only</option><option value="not required">Nearby hotels are fine</option></select></Field>
              <Field label="Required onsite sleeping capacity"><TextInput testId="onsite-sleep-count" value={plan.onsiteSleepCount} onChange={onsiteSleepCount => patch({ onsiteSleepCount })} placeholder="70–80 guests, 20 rooms, VIP only" /></Field>
              <Field label="Nearby lodging okay?"><TextInput value={plan.nearbyLodgingOk} onChange={nearbyLodgingOk => patch({ nearbyLodgingOk })} placeholder="Yes if shuttle under 20 minutes, no, maybe" /></Field>
              <Field label="Outside catering"><select data-testid="outside-catering" value={plan.outsideCatering} onChange={event => patch({ outsideCatering: event.target.value })} className="rounded-2xl border border-charcoal/10 bg-white p-3"><option value="">Not decided yet</option><option value="required">Required</option><option value="preferred">Preferred</option><option value="venue catering ok">Venue catering okay</option></select></Field>
              <Field label="Outside bar / BYO alcohol"><TextInput value={plan.outsideBar} onChange={outsideBar => patch({ outsideBar })} placeholder="Required, preferred, not important, unknown" /></Field>
              <Field label="Vendor freedom"><TextInput value={plan.vendorFreedom} onChange={vendorFreedom => patch({ vendorFreedom })} placeholder="Must allow outside vendors, preferred list okay, exclusive vendors okay" /></Field>
              <Field label="Production/rental freedom"><TextInput value={plan.productionFreedom} onChange={productionFreedom => patch({ productionFreedom })} placeholder="Tent, lighting, florals, rentals, dance floor, fireworks, amplified music" /></Field>
              <Field label="Rain backup"><TextInput value={plan.rainBackup} onChange={rainBackup => patch({ rainBackup })} placeholder="Required, indoor backup, tent okay, not sure" /></Field>
              <Field label="Curfew/music flexibility"><TextInput value={plan.curfewFlexibility} onChange={curfewFlexibility => patch({ curfewFlexibility })} placeholder="Late-night party required, flexible, quiet event okay" /></Field>
              <Field label="Accessibility / elderly guest comfort"><TextInput value={plan.accessibilityNeeds} onChange={accessibilityNeeds => patch({ accessibilityNeeds })} placeholder="Minimal stairs, shuttle, bathrooms, heat comfort, older relatives" /></Field>
              <Field label="Cultural/religious food needs"><TextInput value={plan.culturalFoodNeeds} onChange={culturalFoodNeeds => patch({ culturalFoodNeeds })} placeholder="Kosher, halal, vegetarian, family recipes, cultural ceremony meal" /></Field>
            </div>
            <div className="mt-4"><p className="text-sm font-bold">Venue types under consideration</p><div className="mt-2 flex flex-wrap gap-2">{venueTypeOptions.map(option => <PillButton key={option} active={plan.venueTypes.includes(option)} onClick={() => toggle('venueTypes', option)}>{option}</PillButton>)}</div></div>
            <div className="mt-4"><p className="text-sm font-bold">Multi-day event needs</p><div className="mt-2 flex flex-wrap gap-2">{multiDayOptions.map(option => <PillButton key={option} active={plan.multiDayEvents.includes(option)} onClick={() => toggle('multiDayEvents', option)}>{option}</PillButton>)}</div></div>
          </div>}

          <div className="rounded-3xl bg-white p-4" data-testid="fixed-flexible-unknown">
            <h4 className="font-serif text-3xl">Fixed / flexible / unknown</h4>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="What is fixed?"><TextArea testId="fixed-items" value={plan.fixedItems} onChange={fixedItems => patch({ fixedItems })} placeholder="Italy, full buyout, sleeps 70–80, outside catering" /></Field>
              <Field label="What is flexible?"><TextArea value={plan.flexibleItems} onChange={flexibleItems => patch({ flexibleItems })} placeholder="Exact region, date, villa vs borgo, nearby lodging" /></Field>
              <Field label="What is unknown?"><TextArea value={plan.unknownItems} onChange={unknownItems => patch({ unknownItems })} placeholder="Floral budget, rain backup, guest transport, vendor team" /></Field>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Total wedding budget comfort"><TextInput testId="budget-target" value={plan.budgetTarget} onChange={budgetTarget => patch({ budgetTarget })} placeholder="65000, 150000, unknown" /></Field>
            <Field label="Hard ceiling"><TextInput value={plan.hardCeiling} onChange={hardCeiling => patch({ hardCeiling })} placeholder="Do not exceed this number, or unknown" /></Field>
            <Field label="Venue / food-bar comfort"><TextInput value={plan.venueBudget} onChange={venueBudget => patch({ venueBudget })} placeholder="35000, 80000, not sure" /></Field>
            <Field label="Floral / decor / rentals comfort"><TextInput value={plan.floralDecorBudget} onChange={floralDecorBudget => patch({ floralDecorBudget })} placeholder="8000, 30000, protect but control" /></Field>
            <Field label="Photo / video comfort"><TextInput value={plan.photoVideoBudget} onChange={photoVideoBudget => patch({ photoVideoBudget })} placeholder="7000, 20000, high priority" /></Field>
            <Field label="Guest hospitality / travel support"><TextInput value={plan.hospitalityBudget} onChange={hospitalityBudget => patch({ hospitalityBudget })} placeholder="shuttles, welcome bags, welcome party, hotel help" /></Field>
          </div>

          <div className="rounded-3xl bg-ivory p-4" data-testid="style-constraints">
            <h4 className="font-serif text-3xl">Style, colors, and atmosphere</h4>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Colors loved"><TextInput testId="colors-loved" value={plan.colorsLoved} onChange={colorsLoved => patch({ colorsLoved })} placeholder="pink, orange, yellow, butter, coral, blush" /></Field>
              <Field label="Colors avoided"><TextInput value={plan.colorsAvoided} onChange={colorsAvoided => patch({ colorsAvoided })} placeholder="no burgundy, no neon, not too much pink" /></Field>
              <Field label="Make it feel like"><TextArea value={plan.makeItFeelLike} onChange={makeItFeelLike => patch({ makeItFeelLike })} placeholder="romantic Italian villa dinner, beach but still formal, Southern garden party" /></Field>
              <Field label="Do not make it feel like"><TextArea value={plan.avoidFeelingLike} onChange={avoidFeelingLike => patch({ avoidFeelingLike })} placeholder="cheesy tropical, rustic barn, childish, stiff ballroom" /></Field>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-4" data-testid="protected-priorities">
            <h4 className="font-serif text-3xl">Protect what matters.</h4>
            <p className="mt-2 text-sm text-charcoal/70">The app keeps the top three priorities safe when suggesting savings.</p>
            <div className="mt-3 flex flex-wrap gap-2">{priorityOptions.map(option => <PillButton key={option} testId={`priority-${testIdFrom(option)}`} active={plan.priorities.includes(option)} onClick={() => toggle('priorities', option)}>{option}</PillButton>)}</div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="Areas willing to save"><TextArea value={plan.saveAreas} onChange={saveAreas => patch({ saveAreas })} placeholder="favors, extra signage, printed programs, lounge rentals" /></Field>
              <Field label="Never compromise"><TextArea value={plan.noCompromiseAreas} onChange={noCompromiseAreas => patch({ noCompromiseAreas })} placeholder="guest comfort, flowers, privacy, food, photography" /></Field>
              <Field label="Biggest fear"><TextArea value={plan.biggestFear} onChange={biggestFear => patch({ biggestFear })} placeholder="It feels cheap, guests uncomfortable, bad photos, family logistics" /></Field>
            </div>
          </div>
        </div>}
      </Card>
    </section>

    <section id="step-1" className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Step 1</Badge><h2 className="mt-3 font-serif text-3xl">Recommendation Studio.</h2><p className="mt-2 text-sm text-charcoal/65">Ask the veteran planner brain anything. It uses your constraints if they exist, or helps discover them if they do not.</p></div>
      <Card data-testid="recommendation-studio">
        <h3 className="font-serif text-4xl">Stumped? Ask Recommendation Studio.</h3>
        <p className="mt-3 text-charcoal/70">Try: “Italy, full buyout, sleeps 70–80, outside catering required,” or “I want pink, orange, and yellow flowers for a beach wedding.”</p>
        <div className="mt-4 rounded-2xl bg-ivory p-4 text-sm" data-testid="studio-constraint-summary"><strong>Using saved constraints:</strong> {planningConstraintSummary(plan)}</div>
        <div className="mt-5 grid gap-4 md:grid-cols-[260px_1fr]">
          <Field label="Focus area"><select data-testid="recommendation-focus" value={plan.recommendationFocus} onChange={event => patch({ recommendationFocus: event.target.value as PlannerBucket })} className="rounded-2xl border border-charcoal/10 bg-white p-3">{plannerBuckets.map(bucket => <option key={bucket}>{bucket}</option>)}</select></Field>
          <Field label="Ask the master planner anything"><TextArea testId="recommendation-question" value={plan.recommendationQuestion} onChange={recommendationQuestion => patch({ recommendationQuestion })} placeholder="I want pink, orange, and yellow flowers. What combinations would work with my venue, budget, season, and protected priorities?" /></Field>
        </div>
        <p className="mt-2 text-sm text-charcoal/65">{plannerBucketDescriptions[plan.recommendationFocus]}</p>
        <button data-testid="run-recommendation" disabled={!plan.recommendationQuestion.trim() && plan.constraintMode !== 'discovery'} onClick={runRecommendation} className="mt-5 rounded-full bg-charcoal px-6 py-3 font-bold text-linen disabled:opacity-40">Generate and save recommendation</button>
        {!plan.constraintMode && <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm">Recommendation Studio works best after Step 0. You can ask anyway, but the answer will be more generic until constraints are saved.</p>}
        {recommendation && <div data-testid="recommendation-output" className="mt-6 grid gap-4">
          <Card className="bg-white shadow-none"><Badge>Planner read</Badge><p className="mt-3 leading-7">{recommendation.plannerRead}</p></Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-white shadow-none"><h4 className="font-serif text-2xl">Best-fit directions</h4><ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{recommendation.bestFitDirections.map(item => <li key={item}>{item}</li>)}</ul></Card>
            <Card className="bg-white shadow-none"><h4 className="font-serif text-2xl">Constraint conflicts</h4><ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{recommendation.constraintConflicts.map(item => <li key={item}>{item}</li>)}</ul></Card>
            <Card className="bg-white shadow-none"><h4 className="font-serif text-2xl">Budget implications</h4><ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{recommendation.budgetImplications.map(item => <li key={item}>{item}</li>)}</ul></Card>
            <Card className="bg-white shadow-none"><h4 className="font-serif text-2xl">Vendor questions + next decisions</h4><ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{[...recommendation.vendorQuestions, ...recommendation.nextDecisionChecklist].map(item => <li key={item}>{item}</li>)}</ul></Card>
          </div>
          <Trace label="Recommendation Studio uses saved constraints + seeded planner heuristics, not live vendor data" confidence={recommendation.confidence} />
        </div>}
      </Card>
    </section>

    <section id="step-2" className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Step 2</Badge><h2 className="mt-3 font-serif text-3xl">Venue + Lodging Matchmaker.</h2><p className="mt-2 text-sm text-charcoal/65">Uses buyout, sleeping capacity, catering freedom, guest count, travel, and protected priorities.</p></div>
      <Card data-testid="venue-finder">
        <h3 className="font-serif text-4xl">Constraint-powered venue strategy.</h3>
        <p data-testid="venue-match-summary" className="mt-3 rounded-2xl bg-ivory p-4 text-sm font-semibold">{venueMatchSummary(plan)}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">{venueExamples.map(venue => {
          const active = plan.selectedVenueIds.includes(venue.id);
          return <Card key={venue.id} className={`shadow-none ${active ? 'border-charcoal bg-charcoal text-linen' : 'bg-white'}`}>
            <Badge tone={venue.budgetFit.includes('Strong') ? 'success' : venue.budgetFit.includes('Stretch') || venue.budgetFit.includes('not') ? 'warning' : 'neutral'}>{venue.budgetFit}</Badge>
            <h4 className="mt-3 font-serif text-2xl">{venue.name}</h4>
            <p className={`mt-2 text-sm ${active ? 'text-linen/75' : 'text-charcoal/70'}`}>{venue.location} · {venue.venueType} · {venue.capacity}</p>
            <p className="mt-3 font-bold">{venue.estimatedAllIn}</p>
            <p className={`mt-3 text-xs ${active ? 'text-linen/70' : 'text-charcoal/60'}`}>{venue.sourceLabel}. Confidence: {venue.confidence}. Verify: {venue.verify.join(', ')}.</p>
            <button data-testid={`select-venue-${venue.id}`} onClick={() => toggleVenue(venue.id)} className={`mt-4 w-full rounded-full px-4 py-3 text-sm font-bold ${active ? 'bg-linen text-charcoal' : 'border border-charcoal/20 bg-white text-charcoal'}`}>{active ? 'Selected venue direction' : 'Select venue direction'}</button>
          </Card>;
        })}</div>
        <div data-testid="selected-venue-summary" className="mt-5 rounded-2xl bg-ivory p-4 text-sm font-semibold">Selected venue strategies: {chosenVenues.length ? chosenVenues.map(v => v.name).join(' · ') : 'Not decided yet'}</div>
        <a href="#step-1" data-testid="venue-to-studio-cta" className="mt-4 inline-flex rounded-full border border-charcoal/20 bg-white px-5 py-3 font-bold">Not sure which venue type fits? Ask Recommendation Studio.</a>
      </Card>
    </section>

    <section id="step-3" className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Step 3</Badge><h2 className="mt-3 font-serif text-3xl">Budget + Tradeoff Reality.</h2><p className="mt-2 text-sm text-charcoal/65">Pressure-tests the plan without cutting protected priorities first.</p></div>
      <Card data-testid="budget-reality">
        <h3 className="font-serif text-4xl">Protect what matters.</h3>
        <p className="mt-3 text-charcoal/70">The app keeps the top three priorities safe when suggesting savings.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">{budgetModes.map(mode => <button key={mode.id} data-testid={`budget-${mode.id}`} onClick={() => patch({ budgetMode: mode.id })} className={`rounded-2xl border p-4 text-left ${plan.budgetMode === mode.id ? 'border-charcoal bg-charcoal text-linen' : 'border-charcoal/10 bg-white'}`}><strong>{mode.title}</strong><p className="mt-1 text-sm opacity-75">{mode.copy}</p></button>)}</div>
        <p data-testid="budget-guest-sync" className="mt-5 rounded-2xl bg-white p-4 text-sm font-bold">Guest count synced from Step 0: {plan.guestCount || 'Not decided yet'}</p>
        <p className="mt-3 rounded-2xl bg-ivory p-4 font-semibold">{budgetMessage}</p>
        <p className="mt-3 text-sm"><strong>Protected priorities:</strong> {protectedItems.length ? protectedItems.join(' · ') : 'Choose top three in Step 0.'}</p>
        <a href="#step-1" data-testid="budget-to-studio-cta" className="mt-4 inline-flex rounded-full border border-charcoal/20 bg-white px-5 py-3 font-bold">Need tradeoffs that protect your top three priorities? Ask Recommendation Studio.</a>
        <Trace label="Budget math from guest count + user budget + venue/lodging/catering constraints + protected priorities" confidence="Low/Medium" />
      </Card>
    </section>

    <section id="step-4" className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Step 4</Badge><h2 className="mt-3 font-serif text-3xl">Design + scope.</h2><p className="mt-2 text-sm text-charcoal/65">Translate theme, colors, photos, and descriptions into planner/vendor language.</p></div>
      <div className="space-y-6">
        <Card data-testid="vibe-translator">
          <h3 className="font-serif text-4xl">Vibe, theme, and design direction.</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Describe the vibe in your own words"><TextArea testId="own-vibe-input" value={plan.ownVibeWords} onChange={ownVibeWords => patch({ ownVibeWords })} placeholder="intimate candlelit garden dinner party, elegant but not stiff, not rustic" /></Field>
            <Field label="Inspiration notes"><TextArea value={plan.inspirationNotes} onChange={inspirationNotes => patch({ inspirationNotes })} placeholder="bows, citrus colors, candlelight, villa, soft but not childish" /></Field>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">{Object.entries(visionQuestions).map(([rawKey, values]) => {
            const key = rawKey as keyof typeof visionKeyMap;
            const planKey = visionKeyMap[key];
            return <div key={key}><p className="text-sm font-bold capitalize">{key}</p><div className="mt-2 flex flex-wrap gap-2">{values.map(value => <PillButton key={value} active={(plan[planKey] as string[]).includes(value)} onClick={() => toggle(planKey, value)}>{value}</PillButton>)}</div></div>;
          })}</div>
          <div data-testid="vibe-translator-output" className="mt-5 rounded-2xl bg-ivory p-4 text-sm"><strong>Interpreted custom direction:</strong> {translator.summary}<br /><strong>Planner implication:</strong> {designDirection(plan)}</div>
          <Trace label="User wording + selected style pills; no preset overwrites reality" confidence="Medium" />
        </Card>

        <Card data-testid="scope-intelligence"><h3 className="font-serif text-4xl">Photo/Description-to-Scope Intelligence</h3><p className="mt-3 text-charcoal/70">Upload or describe anything. Price the scope, vendors, and verification path. Have an idea but no photo? Ask Recommendation Studio or use the Photos Lab.</p><div className="mt-4 flex flex-wrap gap-3"><Link data-testid="photos-cta-tablescape" className="rounded-2xl bg-white px-4 py-3 text-sm font-bold" href="/photos">Upload tablescape inspiration</Link><Link data-testid="photos-cta-attire" className="rounded-2xl bg-white px-4 py-3 text-sm font-bold" href="/photos">Upload attire / flower girl dresses</Link><Link data-testid="photos-cta-anything" className="rounded-2xl border border-charcoal/20 bg-white px-4 py-3 text-sm font-bold" href="/photos">Scope anything else you care about</Link><a data-testid="scope-to-studio-cta" className="rounded-2xl border border-charcoal/20 bg-white px-4 py-3 text-sm font-bold" href="#step-1">Ask Recommendation Studio</a></div><div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="What are we scoping?"><select data-testid="scope-category" value={scopeCategory} onChange={event => setScopeCategory(event.target.value)} className="rounded-2xl border border-charcoal/10 bg-white p-3">{inspirationCategories.map(cat => <option key={cat}>{cat}</option>)}</select></Field><Field label="Upload inspiration photo"><input data-testid="photo-input" type="file" accept="image/*" onChange={event => setFileName(event.target.files?.[0]?.name || '')} className="rounded-2xl border border-dashed border-charcoal/20 bg-white p-3" /></Field></div>{fileName && <p className="mt-3 font-semibold">Selected image: {fileName}</p>}<Field label="Or describe it in your own words"><TextArea testId="scope-description" value={scopeDescription} onChange={setScopeDescription} placeholder="long tables with lace cloths, candles everywhere, soft pink flowers, bows on chairs, maybe chandeliers" /></Field><div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm"><strong>Photo analysis notice:</strong> To analyze photos later, images may be sent to a third-party visual/search provider. No fake live vendor/product search is claimed. Results are planning estimates only and may be wrong. Exact pricing, vendor fit, product match, and availability require verification.</div><label className="mt-4 flex gap-2 text-sm"><input data-testid="photo-consent" type="checkbox" checked={photoConsent} onChange={event => setPhotoConsent(event.target.checked)} /> I understand and want to analyze this photo/description.</label><button data-testid="analyze-photo" disabled={(!fileName && !scopeDescription.trim()) || !photoConsent} onClick={analyzeScope} className="mt-4 rounded-full bg-charcoal px-6 py-3 font-bold text-linen disabled:opacity-40">Analyze and save scope</button>{photoAnalyzed && <Card className="mt-6 bg-ivory shadow-none" data-testid="photo-results"><Badge>{selectedScope.title}</Badge><h4 className="mt-3 font-serif text-3xl">Scope estimate, vendor map, and verification checklist</h4><p className="mt-2 text-sm text-charcoal/70">{selectedScope.intakePrompt}</p><div className="mt-5 grid gap-4 md:grid-cols-2"><div><strong>Missing questions</strong><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{selectedScope.missingQuestions.map(q => <li key={q}>{q}</li>)}</ul></div><div><strong>Likely table count</strong><p className="mt-2 text-sm">{tableCountFromPlan(plan)}</p><strong className="mt-4 block">Vendors likely needed</strong><p className="mt-2 text-sm">{selectedScope.vendorsNeeded.join(' · ')}</p></div></div><div className="mt-5 grid gap-3">{selectedScope.components.map(component => <div key={component.name} className="rounded-2xl bg-white p-4"><strong>{component.name}</strong><p className="mt-1 text-sm">{component.visibleStatus} · {component.quantityBasis} · {component.estimate}</p><p className="mt-2 text-xs text-charcoal/60">Vendors: {component.vendors.join(', ')}. Confidence: {component.confidence}. Verify: {component.verificationQuestions.join(' ')}</p></div>)}</div><div className="mt-5 grid gap-3 md:grid-cols-2"><div><strong>Warnings</strong><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{selectedScope.warnings.map(w => <li key={w}>{w}</li>)}</ul></div><div><strong>Inquiry starter</strong><p className="mt-2 rounded-2xl bg-white p-3 text-sm">{selectedScope.inquiryStarter}</p></div></div><Trace label="Uploaded inspiration or bride description + seeded scope benchmarks" confidence={selectedScope.confidence} /></Card>}</Card>
      </div>
    </section>

    <section id="step-5" className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Step 5</Badge><h2 className="mt-3 font-serif text-3xl">Vendor Team + Inquiry Builder.</h2><p className="mt-2 text-sm text-charcoal/65">Mark vendor categories that need sourcing or inquiry questions.</p></div>
      <Card data-testid="vendor-map"><h3 className="font-serif text-4xl">Choose vendor focus areas.</h3><div className="mt-5 grid gap-4 md:grid-cols-2">{vendorCategories.map(vendor => { const active = plan.selectedVendorCategories.includes(vendor.name); return <Card key={vendor.name} className={`shadow-none ${active ? 'border-charcoal bg-charcoal text-linen' : 'bg-white'}`}><h4 className="font-serif text-2xl">{vendor.name}</h4><ul className={`mt-3 list-disc space-y-1 pl-5 text-sm ${active ? 'text-linen/80' : 'text-charcoal/70'}`}>{vendor.questions.map(question => <li key={question}>{question}</li>)}</ul><button data-testid={`select-vendor-${testIdFrom(vendor.name)}`} onClick={() => toggleVendor(vendor.name)} className={`mt-4 w-full rounded-full px-4 py-3 text-sm font-bold ${active ? 'bg-linen text-charcoal' : 'border border-charcoal/20 bg-white text-charcoal'}`}>{active ? 'Selected vendor focus' : 'Add vendor focus'}</button><Trace label="Vendor type guidance; specific vendors require sourced data" confidence="Medium" /></Card>; })}</div><div data-testid="selected-vendor-summary" className="mt-5 rounded-2xl bg-ivory p-4 text-sm font-semibold">Vendor focus areas: {chosenVendors.length ? chosenVendors.map(v => v.name).join(' · ') : 'Not decided yet'}</div><a href="#step-1" data-testid="vendor-to-studio-cta" className="mt-4 inline-flex rounded-full border border-charcoal/20 bg-white px-5 py-3 font-bold">Need better vendor questions? Ask Recommendation Studio.</a></Card>
    </section>

    <section id="step-6" className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Step 6</Badge><h2 className="mt-3 font-serif text-3xl">Standout ideas + inspiration templates.</h2><p className="mt-2 text-sm text-charcoal/65">Concrete wow moments only. Nothing is selected until the bride chooses it. Templates do not overwrite location, budget, guest count, or constraints.</p></div>
      <div className="space-y-6"><Card data-testid="inspiration-templates"><h3 className="font-serif text-4xl">Optional inspiration templates</h3><div className="mt-5 grid gap-4 md:grid-cols-3">{inspirationTemplates.map(template => <button type="button" key={template.name} onClick={() => applyTemplate(template.name)} className={`rounded-3xl border p-4 text-left ${plan.selectedTemplate === template.name ? 'border-charcoal bg-charcoal text-linen' : 'border-charcoal/10 bg-linen'}`}><strong>{template.name}</strong><p className="mt-2 text-sm opacity-75">Adopt: {template.adopt.join(', ')}</p><p className="mt-2 text-xs opacity-70">Does not adopt: {template.doNotAdopt.join(', ')}</p></button>)}</div><Trace label="Template is inspiration only; no active wedding state overwrite" confidence="High" /></Card><div className="grid gap-4 md:grid-cols-3">{featuredStandoutIdeas.map(trend => <Card key={trend.id} className="shadow-none"><TrendCard trend={trend} compact /><button data-testid={`toggle-trend-${trend.id}`} onClick={() => toggleTrend(trend.id)} className="mt-3 w-full rounded-full border border-charcoal/20 bg-white px-4 py-2 text-sm font-bold">{plan.selectedTrends.includes(trend.id) ? 'Remove from working plan' : 'Add to working plan'}</button></Card>)}</div><Link href="/trends" className="inline-flex rounded-full bg-charcoal px-5 py-3 text-sm font-bold text-linen">Open full Standout Ideas Catalogue</Link></div>
    </section>

    <section id="step-7" className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Step 7</Badge><h2 className="mt-3 font-serif text-3xl">Planner Packet.</h2><p className="mt-2 text-sm text-charcoal/65">Output is more valuable than intake.</p></div>
      <Card data-testid="step-pack"><h3 className="font-serif text-4xl">Planner-ready working brief preview</h3><p className="mt-3 leading-7">{brief}</p><div className="mt-5 grid gap-4 md:grid-cols-3"><p><strong>Constraint mode:</strong><br />{plan.constraintMode || 'Not decided yet'}</p><p><strong>Location:</strong><br />{plan.locations || 'Not decided yet'}</p><p><strong>Guest count:</strong><br />{plan.guestCount || 'Not decided yet'}</p><p><strong>Budget:</strong><br />{displayEstimate}</p><p><strong>Protected priorities:</strong><br />{protectedItems.length ? protectedItems.join(', ') : 'Not decided yet'}</p><p><strong>Selected venues:</strong><br />{chosenVenues.length ? chosenVenues.map(v => v.name).join(', ') : 'Not decided yet'}</p><p><strong>Vendor focus:</strong><br />{chosenVendors.length ? chosenVendors.map(v => v.name).join(', ') : 'Not decided yet'}</p><p><strong>Recommendation Studio:</strong><br />{recommendation ? 'Saved recommendation included' : 'No Recommendation Studio recommendation saved yet'}</p><p><strong>Design scope:</strong><br />{photoAnalyzed ? selectedScope.title : 'Not analyzed yet'}</p></div><div data-testid="risk-reality-check" className="mt-5 rounded-2xl bg-ivory p-4"><strong>Risk / Reality Check:</strong><ul className="mt-2 list-disc pl-5 text-sm">{risks.map(risk => <li key={risk}>{risk}</li>)}</ul></div><div className="mt-5 rounded-2xl bg-ivory p-4"><strong>Source trace:</strong> Chosen by user + interpreted from wording/photos + seeded estimates + verification caveats. No exact pricing, availability, or vendor claim is presented without source/confidence labels.</div><Link href="/pack" className="mt-6 inline-flex rounded-full bg-charcoal px-6 py-3 font-bold text-linen">Open full packet</Link><div className="mt-5 grid gap-3 text-sm">{Object.values(disclaimers).map(item => <p key={item} className="rounded-2xl bg-white p-3">{item}</p>)}</div></Card>
    </section>

    <section className="grid gap-4 md:grid-cols-3" data-testid="planner-bucket-map">{planningBuckets.map(bucket => <Card key={bucket}><Badge>Bucket</Badge><h3 className="mt-3 font-serif text-2xl">{bucket}</h3><p className="mt-2 text-sm text-charcoal/70">Recommendation Studio can reason across this bucket using the saved Constraint Profile.</p></Card>)}</section>
    <section className="grid gap-4 md:grid-cols-3" data-testid="scope-components-map">{scopeComponents.map(scope => <Card key={scope.category}><Badge>{scope.category}</Badge><p className="mt-3 text-sm"><strong>Components:</strong> {scope.components.join(' · ')}</p><p className="mt-3 text-sm"><strong>Vendors:</strong> {scope.vendors.join(' · ')}</p><p className="mt-3 text-xs text-charcoal/60"><strong>Warnings:</strong> {scope.warnings.join(' · ')}</p></Card>)}</section>
    <section className="grid gap-4 md:grid-cols-4">{inspirationScopes.map(scope => <Card key={scope.title}><Badge>{scope.confidence} confidence</Badge><h3 className="mt-3 font-serif text-2xl">{scope.title}</h3><p className="mt-2 text-sm text-charcoal/70">{scope.intakePrompt}</p></Card>)}</section>

    <section className="rounded-[1.75rem] border border-charcoal/10 bg-white p-7"><h2 className="font-serif text-4xl">When the plan stops changing</h2><p className="mt-3 max-w-3xl text-base leading-7 text-charcoal/70">This builder works out the shape of the wedding. Executing it takes files you can edit and hand to other people: the checklist, the budget workbook, the master timeline, and the seating plan.</p><Link href="/shop" className="mt-4 inline-flex font-bold underline underline-offset-4">Compare the four wedding planning tools and prices →</Link></section>

    <StickyTotal total={displayEstimate} />
  </div>;
}
