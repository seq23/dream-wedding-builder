import { Card, Badge } from './Card';
import type { Category } from '@/data/types';
import { money, range } from '@/lib/format';
export function CategoryCard({ category }: { category: Category }) {
  const e = category.estimate;
  return <Card data-testid={`category-${category.id}`}>
    <div className="flex items-start justify-between gap-4">
      <div><h3 className="font-serif text-2xl">{category.name}</h3><p className="mt-1 text-sm text-charcoal/70">{category.description}</p></div>
      <Badge>{e.confidence}</Badge>
    </div>
    <div className="mt-5 grid gap-3 rounded-2xl bg-ivory p-4 md:grid-cols-3">
      <div><p className="text-xs uppercase text-charcoal/50">Likely</p><p className="text-xl font-bold">{money(e.likely, e.currency)}</p></div>
      <div><p className="text-xs uppercase text-charcoal/50">Range</p><p className="font-semibold">{range(e.low, e.high, e.currency)}</p></div>
      <div><p className="text-xs uppercase text-charcoal/50">Source</p><p className="font-semibold">{e.sourceType}</p></div>
    </div>
    <p className="mt-4 text-sm"><strong>Planner note:</strong> {category.plannerTip}</p>
    <details className="mt-4"><summary className="cursor-pointer font-semibold">Hidden costs + levers</summary><div className="mt-3 grid gap-3 md:grid-cols-2"><ul className="list-disc pl-5 text-sm text-charcoal/75">{e.hiddenCosts.map(h => <li key={h}>{h}</li>)}</ul><ul className="list-disc pl-5 text-sm text-charcoal/75">{category.levers.map(l => <li key={l}>{l}</li>)}</ul></div></details>
  </Card>;
}
