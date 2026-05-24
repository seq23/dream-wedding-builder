'use client';
import { Card, Badge } from './Card';
import type { Trend } from '@/data/types';
export function TrendCard({ trend }: { trend: Trend }) {
  const add = () => {
    const existing = JSON.parse(localStorage.getItem('dwb-trends') || '[]');
    localStorage.setItem('dwb-trends', JSON.stringify([...existing.filter((t: Trend) => t.id !== trend.id), trend]));
    window.dispatchEvent(new Event('dwb-updated'));
    alert(`${trend.name} added to your dashboard.`);
  };
  return <Card data-testid={`trend-${trend.id}`} className="flex h-full flex-col">
    <div className="mb-4 rounded-2xl bg-gradient-to-br from-champagne/40 to-sage/30 p-8 text-center font-serif text-4xl">✦</div>
    <h3 className="font-serif text-2xl">{trend.name}</h3>
    <p className="mt-2 flex-1 text-sm leading-6 text-charcoal/70">{trend.description}</p>
    <div className="mt-4 flex flex-wrap gap-2">{trend.labels.map(l => <Badge key={l} tone={l.includes('Warning') || l.includes('Complex') ? 'warning' : 'neutral'}>{l}</Badge>)}</div>
    <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><p><strong>Cost:</strong><br />{trend.costRange}</p><p><strong>Complexity:</strong><br />{trend.complexity}</p><p><strong>Guest:</strong><br />{trend.guestImpact}</p><p><strong>Photo:</strong><br />{trend.photoImpact}</p></div>
    <div className="mt-5 flex flex-col gap-2"><button onClick={add} className="rounded-full bg-charcoal px-4 py-3 text-sm font-bold text-linen">Add to Dashboard</button><a href={`/trends#${trend.id}`} className="rounded-full border border-charcoal/20 px-4 py-3 text-center text-sm font-bold">Explore Pricing + Vendors</a></div>
  </Card>;
}
