'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CategoryCard } from '@/components/CategoryCard';
import { Card, Badge } from '@/components/Card';
import { StickyTotal } from '@/components/StickyTotal';
import { categories } from '@/data/categories';
import { levers } from '@/data/levers';
import { money, range } from '@/lib/format';
import type { Trend } from '@/data/types';

export default function DashboardPage() {
  const [plan, setPlan] = useState({ mode: 'dream', location: 'Lake Como', guests: 125, style: 'Old Money Garden Elegance' });
  const [addedTrends, setAddedTrends] = useState<Trend[]>([]);
  const [strictBudget, setStrictBudget] = useState(75000);
  const baseLikely = useMemo(() => categories.reduce((s,c)=>s+c.estimate.likely,0), []);
  const trendCost = addedTrends.length * 3500;
  const likely = baseLikely + trendCost;
  useEffect(() => {
    const load = () => {
      const p = localStorage.getItem('dwb-plan'); if (p) setPlan(JSON.parse(p));
      const t = localStorage.getItem('dwb-trends'); if (t) setAddedTrends(JSON.parse(t));
    };
    load(); window.addEventListener('dwb-updated', load); return () => window.removeEventListener('dwb-updated', load);
  }, []);
  const over = plan.mode === 'strict' && likely > strictBudget;
  return <div className="space-y-6"><section className="grid gap-4 lg:grid-cols-[1fr_340px]"><Card><Badge>Flow 2 · Dashboard + Cost Levers</Badge><h1 className="mt-4 font-serif text-5xl">{plan.style}</h1><p className="mt-2 text-charcoal/70">{plan.location} · {plan.guests} guests · {plan.mode === 'dream' ? 'No Budget / Dream Mode' : plan.mode === 'strict' ? 'Strict Budget Mode' : 'Flexible Range'}</p><div className="mt-6 grid gap-4 md:grid-cols-3"><div><p className="text-xs uppercase text-charcoal/50">Estimated total</p><p data-testid="dashboard-total" className="font-serif text-4xl">{range(Math.round(likely*.72), Math.round(likely*1.35))}</p></div><div><p className="text-xs uppercase text-charcoal/50">Top cost drivers</p><p className="font-semibold">Venue · Food + Bar · Florals · Production</p></div><div><p className="text-xs uppercase text-charcoal/50">Selected trends</p><p className="font-semibold">{addedTrends.length}</p></div></div></Card><Card><h2 className="font-serif text-2xl">Next best actions</h2><div className="mt-4 grid gap-2"><Link className="rounded-full bg-charcoal px-4 py-3 text-center text-sm font-bold text-linen" href="/trends">Add trends</Link><Link className="rounded-full border border-charcoal/20 px-4 py-3 text-center text-sm font-bold" href="/photos">Upload inspiration</Link><Link className="rounded-full border border-charcoal/20 px-4 py-3 text-center text-sm font-bold" href="/pack">Create Starter Pack</Link></div></Card></section>{over && <Card className="border-amber-300 bg-amber-50" data-testid="strict-warning"><h2 className="font-serif text-3xl">Budget Warning</h2><p className="mt-2">This plan is over your strict budget by <strong>{money(likely - strictBudget)}</strong>. You can keep it — we just need to decide whether to increase the budget or reduce cost somewhere else.</p><div className="mt-4 grid gap-3 md:grid-cols-4"><button className="rounded-full bg-charcoal px-4 py-3 text-sm font-bold text-linen">Keep item + adjust levers</button><button className="rounded-full border border-charcoal/20 bg-white px-4 py-3 text-sm font-bold">Choose cheaper option</button><button data-testid="increase-budget" onClick={() => setStrictBudget(likely)} className="rounded-full border border-charcoal/20 bg-white px-4 py-3 text-sm font-bold">Increase my budget</button><button data-testid="turn-off-strict" onClick={() => setPlan(p => ({...p, mode: 'dream'}))} className="rounded-full border border-charcoal/20 bg-white px-4 py-3 text-sm font-bold">Turn off strict budget</button></div></Card>}<section><h2 className="font-serif text-4xl">Cost levers</h2><div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{levers.map(l => <Card key={l.id}><h3 className="font-serif text-2xl">{l.title}</h3><p className="mt-2 text-sm"><strong>Current:</strong> {l.current}</p><p className="text-sm"><strong>Alternative:</strong> {l.alternative}</p><p className="mt-3 font-bold">Savings: {range(l.savingsLow,l.savingsHigh)}</p><p className="mt-2 text-sm text-charcoal/70">{l.tradeoff}</p><button className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-bold">Compare</button></Card>)}</div></section>{addedTrends.length > 0 && <section><h2 className="font-serif text-4xl">Selected Trends</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{addedTrends.map(t => <Card key={t.id}><Badge>{t.category}</Badge><h3 className="mt-3 font-serif text-2xl">{t.name}</h3><p className="mt-2 text-sm text-charcoal/70">{t.description}</p><p className="mt-3 font-bold">Planning placeholder: {t.costRange}</p></Card>)}</div></section>}<section><h2 className="font-serif text-4xl">Category Breakdown</h2><div className="mt-4 grid gap-4">{categories.map(c => <CategoryCard key={c.id} category={c} />)}</div></section><StickyTotal total={range(Math.round(likely*.72), Math.round(likely*1.35))} /></div>;
}
