'use client';

import { useState } from 'react';
import { Card, Badge } from './Card';
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

export function TrendCard({ trend, compact = false }: { trend: Trend; compact?: boolean }) {
  const [added, setAdded] = useState(false);
  const add = () => {
    saveTrendToPlan(trend);
    setAdded(true);
  };

  return <Card id={trend.id} data-testid={`trend-${trend.id}`} className={`flex h-full flex-col ${compact ? 'p-4 shadow-none' : ''}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-charcoal/45">{trend.category}</p>
        <h3 className="mt-1 font-serif text-2xl">{trend.name}</h3>
      </div>
      <Badge tone={trend.labels.some(label => label.includes('Verify')) ? 'warning' : 'neutral'}>{trend.budgetPressure || trend.complexity}</Badge>
    </div>
    <p className="mt-3 flex-1 text-sm leading-6 text-charcoal/70">{trend.description}</p>
    {trend.whyItStandsOut && <p className="mt-3 rounded-2xl bg-ivory p-3 text-sm"><strong>Why it stands out:</strong> {trend.whyItStandsOut}</p>}
    {!compact && <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
      <p><strong>Best for:</strong><br />{trend.bestFor || 'Context-dependent'}</p>
      <p><strong>Avoid if:</strong><br />{trend.avoidIf || 'Unclear until venue/vendor review'}</p>
    </div>}
    <div className="mt-3 flex flex-wrap gap-2">{trend.labels.map(label => <Badge key={label} tone={label.includes('Verify') ? 'warning' : 'neutral'}>{label}</Badge>)}</div>
    <p className="mt-3 text-xs leading-5 text-charcoal/55"><strong>Support needed:</strong> {trend.supportNeeded || trend.vendorType}</p>
    <p className="mt-2 text-xs leading-5 text-charcoal/55"><strong>Verify:</strong> {trend.verificationNote || trend.plannerWarning}</p>
    {/* In the planner (compact) the step's own button adds and removes the idea. */}
    {!compact && <div className="mt-4"><button type="button" onClick={add} aria-pressed={added} className="min-h-11 w-full rounded-2xl border border-charcoal/25 bg-white px-4 py-3 text-sm font-bold">{added ? '✓ Added to your plan' : '+ Add to your plan'}</button></div>}
  </Card>;
}
