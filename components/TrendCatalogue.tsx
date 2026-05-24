'use client';

import { useMemo, useState } from 'react';
import { Card, Badge } from './Card';
import { TrendCard } from './TrendCard';
import { trends, standoutIdeaCategories } from '@/data/trends';
import type { Trend } from '@/data/types';

function saveTrendToPlan(trend: Trend) {
  const existingPlan = JSON.parse(localStorage.getItem('dwb-plan') || '{}');
  const selectedTrends = Array.isArray(existingPlan.selectedTrends) ? existingPlan.selectedTrends : [];
  const nextSelected = [...selectedTrends.filter((id: string) => id !== trend.id), trend.id];
  localStorage.setItem('dwb-plan', JSON.stringify({ ...existingPlan, selectedTrends: nextSelected }));
  const existingTrends = JSON.parse(localStorage.getItem('dwb-trends') || '[]');
  localStorage.setItem('dwb-trends', JSON.stringify([...existingTrends.filter((t: Trend) => t.id !== trend.id), trend]));
  window.dispatchEvent(new Event('dwb-updated'));
}

export function TrendCatalogue() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [budget, setBudget] = useState('All');
  const [showCompact, setShowCompact] = useState(true);

  const filtered = useMemo(() => trends.filter(trend => {
    const haystack = [trend.name, trend.category, trend.description, trend.bestFor, trend.avoidIf, trend.whyItStandsOut, trend.supportNeeded, trend.verificationNote, trend.labels.join(' ')].join(' ').toLowerCase();
    const matchesQuery = !query.trim() || haystack.includes(query.toLowerCase());
    const matchesCategory = category === 'All' || trend.category === category;
    const matchesBudget = budget === 'All' || trend.budgetPressure === budget;
    return matchesQuery && matchesCategory && matchesBudget;
  }), [query, category, budget]);

  return <div className="space-y-6" data-testid="standout-catalogue">
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <label className="grid flex-1 gap-2 text-sm font-bold">Search ideas
          <input data-testid="trend-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="champagne wall, scent, pasta, hidden room, color smoke..." className="rounded-2xl border border-charcoal/10 bg-white p-3 font-normal" />
        </label>
        <label className="grid gap-2 text-sm font-bold">Moment type
          <select data-testid="trend-category-filter" value={category} onChange={event => setCategory(event.target.value)} className="rounded-2xl border border-charcoal/10 bg-white p-3 font-normal">
            <option>All</option>
            {standoutIdeaCategories.map(item => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-bold">Budget pressure
          <select data-testid="trend-budget-filter" value={budget} onChange={event => setBudget(event.target.value)} className="rounded-2xl border border-charcoal/10 bg-white p-3 font-normal">
            <option>All</option><option>Low</option><option>Medium</option><option>High</option>
          </select>
        </label>
        <button data-testid="trend-density-toggle" onClick={() => setShowCompact(value => !value)} className="rounded-full border border-charcoal/20 bg-white px-5 py-3 text-sm font-bold">{showCompact ? 'Show detail cards' : 'Show compact index'}</button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-sm"><Badge>{trends.length} standout ideas</Badge><Badge>{filtered.length} visible</Badge><Badge>No venue/vendor availability claimed</Badge></div>
    </Card>

    {showCompact ? <div className="overflow-hidden rounded-3xl border border-charcoal/10 bg-white shadow-soft">
      <div className="hidden grid-cols-[1.1fr_0.9fr_0.8fr_1.2fr_1fr_170px] gap-3 border-b border-charcoal/10 bg-ivory px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-charcoal/55 lg:grid">
        <span>Idea</span><span>Moment</span><span>Budget</span><span>Why it stands out</span><span>Verify</span><span>Action</span>
      </div>
      <div className="divide-y divide-charcoal/10">
        {filtered.map(trend => <div key={trend.id} data-testid={`trend-row-${trend.id}`} className="grid gap-3 px-4 py-4 lg:grid-cols-[1.1fr_0.9fr_0.8fr_1.2fr_1fr_170px] lg:items-center">
          <div><a href={`#${trend.id}`} className="font-serif text-xl hover:underline">{trend.name}</a><p className="mt-1 text-sm text-charcoal/65">{trend.description}</p></div>
          <p className="text-sm font-semibold">{trend.category}</p>
          <p className="text-sm">{trend.budgetPressure || trend.complexity}</p>
          <p className="text-sm text-charcoal/70">{trend.whyItStandsOut}</p>
          <p className="text-xs text-charcoal/55">{trend.verificationNote}</p>
          <div className="flex flex-col gap-2"><button data-testid={`add-trend-${trend.id}`} onClick={() => saveTrendToPlan(trend)} className="rounded-full bg-charcoal px-4 py-2 text-sm font-bold text-linen">Add</button><a className="rounded-full border border-charcoal/20 px-4 py-2 text-center text-xs font-bold" href="/build#step-1">Use in Studio</a></div>
        </div>)}
      </div>
    </div> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map(trend => <TrendCard key={trend.id} trend={trend} />)}</div>}
  </div>;
}
