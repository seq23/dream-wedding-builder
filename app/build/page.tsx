'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, Badge } from '@/components/Card';
import { CategoryCard } from '@/components/CategoryCard';
import { TrendCard } from '@/components/TrendCard';
import { StickyTotal } from '@/components/StickyTotal';
import { budgetModes } from '@/data/budgetModes';
import { categories } from '@/data/categories';
import { levers } from '@/data/levers';
import { trends } from '@/data/trends';
import { plannerTips } from '@/data/tips';
import { disclaimers } from '@/data/disclaimers';
import { money, range } from '@/lib/format';

const priorities = ['Venue', 'Dress', 'Flowers', 'Food', 'Bar', 'Photography', 'Video', 'Music', 'Guest Experience', 'Decor', 'Planner Support'];
const vibeOptions = ['Old Money Garden Elegance', 'Italian Villa Weekend', 'Modern Floral Fantasy', 'Editorial Black-Tie Romance', 'Coastal Aperitivo Party', 'Whimsical Estate Dinner'];
const mustHaves = ['Guest experience', 'Photos/video', 'Food and bar', 'Fashion', 'Flowers', 'Venue drama', 'After-party', 'Family comfort'];
const stepLabels = ['Vision', 'Budget', 'Priorities', 'Trends', 'Photo', 'Pricing', 'Packet'];

export default function BuildPage() {
  const [mode, setMode] = useState('dream');
  const [selected, setSelected] = useState<string[]>(['Venue', 'Photography', 'Guest Experience']);
  const [style, setStyle] = useState('Old Money Garden Elegance');
  const [location, setLocation] = useState('Lake Como');
  const [guests, setGuests] = useState(125);
  const [strictBudget, setStrictBudget] = useState(75000);
  const [selectedTrends, setSelectedTrends] = useState<string[]>(['lake-como-color-smoke']);
  const [fileName, setFileName] = useState('');
  const [photoConsent, setPhotoConsent] = useState(false);
  const [photoAnalyzed, setPhotoAnalyzed] = useState(false);

  const baseLikely = useMemo(() => categories.reduce((sum, category) => sum + category.estimate.likely, 0), []);
  const chosenTrends = trends.filter(trend => selectedTrends.includes(trend.id));
  const trendLikely = chosenTrends.length * 3500;
  const likely = baseLikely + trendLikely;
  const isStrictOver = mode === 'strict' && likely > strictBudget;

  const savePlan = () => {
    const plan = { mode, location, guests, selected, style };
    localStorage.setItem('dwb-plan', JSON.stringify(plan));
    localStorage.setItem('dwb-trends', JSON.stringify(chosenTrends));
    window.dispatchEvent(new Event('dwb-updated'));
  };

  const toggleTrend = (id: string) => {
    setSelectedTrends(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  const togglePriority = (priority: string) => {
    setSelected(current => current.includes(priority) ? current.filter(item => item !== priority) : [...current, priority].slice(-3));
  };

  return <div className="space-y-10 pb-24">
    <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <Badge>Guided Bridal Workbook</Badge>
        <h1 className="mt-4 max-w-4xl font-serif text-5xl leading-tight md:text-7xl">Build the wedding in your head, one calm step at a time.</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-charcoal/70">This is not a dashboard you have to figure out. It is a guided planner: tell us the vibe, protect the budget, choose the moments, compare costs, review photo inspiration, then leave with a printable Dream Wedding Starter Pack.</p>
        <div className="mt-6 flex flex-wrap gap-2" aria-label="Planner steps">{stepLabels.map((label, index) => <a key={label} href={`#step-${index + 1}`} className="rounded-full bg-white px-4 py-2 text-sm font-bold shadow-soft">Step {index + 1}: {label}</a>)}</div>
      </div>
      <Card className="sticky top-6 h-fit">
        <p className="text-xs uppercase tracking-[0.3em] text-charcoal/50">Live estimate</p>
        <p data-testid="guided-total" className="mt-2 font-serif text-4xl">{range(Math.round(likely * .72), Math.round(likely * 1.35))}</p>
        <p className="mt-2 text-sm text-charcoal/70">{location} · {guests} guests · {mode === 'dream' ? 'No Budget / Dream Mode' : mode === 'strict' ? 'Strict Budget Mode' : 'Flexible Range'}</p>
        <div className="mt-5 grid gap-2 text-sm">
          <p><strong>Protected priorities:</strong> {selected.join(', ')}</p>
          <p><strong>Trend moments:</strong> {chosenTrends.length}</p>
          <p><strong>Photo status:</strong> {photoAnalyzed ? 'Inspiration priced' : 'Optional'}</p>
        </div>
        <button data-testid="save-guided-plan" onClick={savePlan} className="mt-6 w-full rounded-full bg-charcoal px-5 py-4 font-bold text-linen">Save this starter plan</button>
        <Link href="/pack" className="mt-3 block rounded-full border border-charcoal/20 bg-white px-5 py-4 text-center font-bold">Open printable pack</Link>
      </Card>
    </section>

    <section id="step-1" className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Step 1</Badge><h2 className="mt-3 font-serif text-3xl">Find the vision.</h2><p className="mt-2 text-sm text-charcoal/65">Start with language a planner, florist, venue, and photographer can understand.</p></div>
      <Card data-testid="step-vision"><h3 className="font-serif text-4xl">What should the wedding feel like?</h3><div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{vibeOptions.map(vibe => <button key={vibe} onClick={() => setStyle(vibe)} className={`rounded-2xl border p-4 text-left font-semibold ${style === vibe ? 'border-charcoal bg-charcoal text-linen' : 'border-charcoal/10 bg-white'}`}>{vibe}</button>)}</div><div className="mt-6 grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">Wedding location<input value={location} onChange={event => setLocation(event.target.value)} className="rounded-2xl border border-charcoal/10 bg-white p-3" /></label><label className="grid gap-2 text-sm font-semibold">Guest count<input type="number" value={guests} onChange={event => setGuests(Number(event.target.value))} className="rounded-2xl border border-charcoal/10 bg-white p-3" /></label></div></Card>
    </section>

    <section id="step-2" className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Step 2</Badge><h2 className="mt-3 font-serif text-3xl">Choose budget behavior.</h2><p className="mt-2 text-sm text-charcoal/65">Budget mode should guide decisions, not shame or trap the bride.</p></div>
      <Card data-testid="step-budget"><h3 className="font-serif text-4xl">How strict should the money guardrails be?</h3><div className="mt-5 grid gap-3 md:grid-cols-3">{budgetModes.map(b => <button key={b.id} data-testid={`budget-${b.id}`} onClick={() => setMode(b.id)} className={`rounded-2xl border p-4 text-left ${mode === b.id ? 'border-charcoal bg-charcoal text-linen' : 'border-charcoal/10 bg-white'}`}><strong>{b.title}</strong><span className="mt-2 block text-sm opacity-75">{b.description}</span></button>)}</div>{mode === 'strict' && <div data-testid="strict-copy" className="mt-5 rounded-2xl bg-amber-100 p-4 text-sm"><strong>Strict Budget Mode:</strong> warns, reconciles, and gives escape hatches. It never traps you. <label className="mt-3 grid gap-2 font-semibold">Strict budget target<input type="number" value={strictBudget} onChange={event => setStrictBudget(Number(event.target.value))} className="rounded-2xl border border-charcoal/10 bg-white p-3" /></label></div>}{isStrictOver && <div data-testid="strict-warning" className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4"><h4 className="font-serif text-2xl">Budget Warning</h4><p className="mt-2">This version is over your strict budget by <strong>{money(likely - strictBudget)}</strong>. Choose an escape hatch:</p><div className="mt-4 flex flex-wrap gap-2"><button className="rounded-full bg-charcoal px-4 py-3 text-sm font-bold text-linen">Keep item + adjust levers</button><button className="rounded-full border border-charcoal/20 bg-white px-4 py-3 text-sm font-bold">Choose cheaper option</button><button data-testid="increase-budget" onClick={() => setStrictBudget(likely)} className="rounded-full border border-charcoal/20 bg-white px-4 py-3 text-sm font-bold">Increase my budget</button><button data-testid="turn-off-strict" onClick={() => setMode('dream')} className="rounded-full border border-charcoal/20 bg-white px-4 py-3 text-sm font-bold">Turn off strict budget</button></div></div>}</Card>
    </section>

    <section id="step-3" className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Step 3</Badge><h2 className="mt-3 font-serif text-3xl">Protect what matters.</h2><p className="mt-2 text-sm text-charcoal/65">The app keeps the top three priorities safe when suggesting savings.</p></div>
      <Card data-testid="step-priorities"><h3 className="font-serif text-4xl">Pick your top 3 non-negotiables.</h3><div className="mt-5 flex flex-wrap gap-2">{priorities.map(priority => <button key={priority} onClick={() => togglePriority(priority)} className={`rounded-full px-4 py-2 text-sm font-bold ${selected.includes(priority) ? 'bg-charcoal text-linen' : 'bg-white'}`}>{priority}</button>)}</div><div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">{mustHaves.map(item => <div key={item} className="rounded-2xl bg-ivory p-4 text-sm"><strong>{item}</strong><p className="mt-1 text-charcoal/60">Marked as a planning lens for vendor questions and cost levers.</p></div>)}</div></Card>
    </section>

    <section id="step-4" className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Step 4</Badge><h2 className="mt-3 font-serif text-3xl">Choose signature moments.</h2><p className="mt-2 text-sm text-charcoal/65">Trends live inside the workbook first. The trend library remains available as a deep-dive page.</p></div>
      <Card data-testid="step-trends"><div className="flex flex-wrap items-end justify-between gap-4"><div><h3 className="font-serif text-4xl">Wedding Trend Concierge</h3><p className="mt-2 text-charcoal/70">Pick the moments that make the wedding feel specific. We flag complexity, cost, and hidden planning risks.</p></div><Link href="/trends" className="rounded-full border border-charcoal/20 bg-white px-4 py-3 text-sm font-bold">Open full trend library</Link></div><div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{trends.slice(0, 6).map(trend => <Card key={trend.id} data-testid={`guided-trend-${trend.id}`} className={`shadow-none ${selectedTrends.includes(trend.id) ? 'border-charcoal' : ''}`}><Badge>{trend.category}</Badge><h4 className="mt-3 font-serif text-2xl">{trend.name}</h4><p className="mt-2 text-sm leading-6 text-charcoal/70">{trend.description}</p><p className="mt-3 text-sm"><strong>Cost:</strong> {trend.costRange}</p><p className="text-sm"><strong>Complexity:</strong> {trend.complexity}</p><button data-testid={`toggle-trend-${trend.id}`} onClick={() => toggleTrend(trend.id)} className="mt-4 rounded-full bg-charcoal px-4 py-3 text-sm font-bold text-linen">{selectedTrends.includes(trend.id) ? 'Added' : 'Add to plan'}</button></Card>)}</div></Card>
    </section>

    <section id="step-5" className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Step 5</Badge><h2 className="mt-3 font-serif text-3xl">Price inspiration safely.</h2><p className="mt-2 text-sm text-charcoal/65">Retail price is not wedding execution cost. The UI says that plainly.</p></div>
      <Card data-testid="step-photo"><h3 className="font-serif text-4xl">Upload a photo only when you are comfortable.</h3><p className="mt-2 text-charcoal/70">Use this for dresses, florals, chandeliers, table settings, shoes, cakes, or venue inspiration. No permanent uploads are claimed in v1.</p><input data-testid="photo-input" type="file" accept="image/*" onChange={event => setFileName(event.target.files?.[0]?.name || '')} className="mt-5 block w-full rounded-2xl border border-dashed border-charcoal/20 bg-white p-8" />{fileName && <p className="mt-3 font-semibold">Selected: {fileName}</p>}<div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm"><strong>Consent required:</strong> photo analysis may use a third-party provider. Do not upload private, sensitive, copyrighted, confidential, or identifying images unless you are comfortable using this feature. Results are estimates only.</div><label className="mt-4 flex gap-2 text-sm"><input data-testid="photo-consent" type="checkbox" checked={photoConsent} onChange={event => setPhotoConsent(event.target.checked)} /> I understand and want to analyze this photo.</label><button data-testid="analyze-photo" disabled={!fileName || !photoConsent} onClick={() => setPhotoAnalyzed(true)} className="mt-4 rounded-full bg-charcoal px-6 py-3 font-bold text-linen disabled:opacity-40">Analyze this photo</button>{photoAnalyzed && <div data-testid="photo-results" className="mt-6 rounded-2xl bg-ivory p-5"><h4 className="font-serif text-2xl">Detected item: crystal chandelier-style reception lighting</h4><p className="mt-2 text-sm text-charcoal/70">No fake live vendor/product search is claimed.</p><div className="mt-4 grid gap-3 md:grid-cols-3">{['Closest Match', 'Cheapest Similar', 'Best Value'].map((label, index) => <div key={label} className="rounded-2xl bg-white p-4 text-sm"><strong>{label}</strong><p className="mt-2">Retail item price: ${[249, 119, 189][index]}</p><p>Wedding execution estimate: $800–$3,500</p><p className="mt-2 text-xs text-charcoal/60">Installation, labor, rigging, power, teardown, venue approval, and insurance are separate.</p></div>)}</div></div>}</Card>
    </section>

    <section id="step-6" className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Step 6</Badge><h2 className="mt-3 font-serif text-3xl">Compare cost paths.</h2><p className="mt-2 text-sm text-charcoal/65">Cheapest possible is not always best. The product should show the tradeoff.</p></div>
      <div className="space-y-4" data-testid="step-pricing"><Card><h3 className="font-serif text-4xl">Vendor + Pricing Explorer</h3><p className="mt-2 text-charcoal/70">Each major category should eventually show Cheapest Possible, Best Value, Best Fit, and Luxury. V1 is seeded and contract-ready, not fake live vendor search.</p><div className="mt-5 grid gap-3 md:grid-cols-4">{['Cheapest Possible', 'Best Value', 'Best Fit', 'Luxury'].map(path => <div key={path} className="rounded-2xl bg-ivory p-4"><strong>{path}</strong><p className="mt-1 text-sm text-charcoal/65">Shown with risks, quality tradeoffs, and verification notes.</p></div>)}</div></Card><div className="grid gap-4 lg:grid-cols-3">{levers.map(lever => <Card key={lever.id}><h4 className="font-serif text-2xl">{lever.title}</h4><p className="mt-2 text-sm"><strong>Current:</strong> {lever.current}</p><p className="text-sm"><strong>Alternative:</strong> {lever.alternative}</p><p className="mt-3 font-bold">Savings: {range(lever.savingsLow, lever.savingsHigh)}</p><p className="mt-2 text-sm text-charcoal/70">{lever.tradeoff}</p></Card>)}</div></div>
    </section>

    <section id="step-7" className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Step 7</Badge><h2 className="mt-3 font-serif text-3xl">Leave with a packet.</h2><p className="mt-2 text-sm text-charcoal/65">The output should be something a bride can send, print, or bring to a planner call.</p></div>
      <Card data-testid="step-pack"><div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-serif text-4xl">Dream Wedding Starter Pack Preview</h3><p className="mt-2 text-charcoal/70">Snapshot, style language, budget breakdown, selected trends, photo notes, vendor inquiry draft, and disclaimers.</p></div><Link onClick={savePlan} href="/pack" className="rounded-full bg-charcoal px-5 py-4 font-bold text-linen">Create Starter Pack</Link></div><div className="mt-6 grid gap-3 md:grid-cols-3"><p className="rounded-2xl bg-ivory p-4"><strong>Style:</strong><br />{style}</p><p className="rounded-2xl bg-ivory p-4"><strong>Location:</strong><br />{location}</p><p className="rounded-2xl bg-ivory p-4"><strong>Estimated total:</strong><br />{range(Math.round(likely * .72), Math.round(likely * 1.35))}</p></div><div className="mt-6 grid gap-4 lg:grid-cols-2"><div><h4 className="font-serif text-2xl">Selected Trends & Experience Ideas</h4><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-charcoal/75">{chosenTrends.map(trend => <li key={trend.id}>{trend.name} — {trend.costRange}</li>)}</ul></div><div><h4 className="font-serif text-2xl">Required Disclaimers</h4><p className="mt-3 text-sm leading-6 text-charcoal/70">{disclaimers.cost} This tool is not a substitute for a professional wedding planner, vendor, attorney, financial advisor, or venue representative.</p></div></div></Card>
    </section>

    <section className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Reference</Badge><h2 className="mt-3 font-serif text-3xl">Planner notes.</h2><p className="mt-2 text-sm text-charcoal/65">Supportive, but below the guided flow so the user is not forced into analysis first.</p></div>
      <div className="grid gap-4 lg:grid-cols-2">{plannerTips.map(tip => <Card key={tip.text}><h4 className="font-serif text-2xl">{tip.type}</h4><p className="mt-2 text-sm text-charcoal/70">{tip.text}</p></Card>)}</div>
    </section>

    <section className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="pt-2"><Badge>Reference</Badge><h2 className="mt-3 font-serif text-3xl">Category details.</h2><p className="mt-2 text-sm text-charcoal/65">Kept in-page for brides who want to scroll and learn without changing context.</p></div>
      <div className="grid gap-4">{categories.map(category => <CategoryCard key={category.id} category={category} />)}</div>
    </section>

    <StickyTotal total={range(Math.round(likely * .72), Math.round(likely * 1.35))} />
  </div>;
}
