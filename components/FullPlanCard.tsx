'use client';

// The end of the free plan (her yes, 7 Nov 2026; prices approved 6 Nov 2026). It sells
// the full plan: every task dated from her wedding day, delivered right after payment
// (owner, 10 Nov 2026). The free count comes from the plan windows; the full count comes
// from the private task list through /api/health/full-plan and is never typed. If that
// count cannot be read, the card says the same thing without a number.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PLAN_WINDOWS } from '@/lib/dated-plan';
import { productById } from '@/lib/products';

export const FREE_TASK_COUNT = PLAN_WINDOWS.reduce((n, w) => n + w.tasks.length, 0);

export interface FullPlanCounts { total: number; payments: number; byWindow: Record<string, number> }
let cached: Promise<FullPlanCounts | null> | null = null;
/** The paid list's public counts, read once per page view. null until read, and when it cannot be read. */
export function useFullPlanCounts(): FullPlanCounts | null {
  const [counts, setCounts] = useState<FullPlanCounts | null>(null);
  useEffect(() => {
    let live = true;
    cached ??= fetch('/api/health/full-plan').then(async res => { const data = await res.json(); return res.ok && typeof data.total === 'number' && data.total > 0 ? (data as FullPlanCounts) : null; }).catch(() => null);
    cached.then(value => { if (live) setCounts(value); });
    return () => { live = false; };
  }, []);
  return counts;
}

export function FullPlanCard() {
  const counts = useFullPlanCounts();
  const pdf = productById('checklist-pdf');
  const bundle = productById('operations-suite');
  if (!pdf || !bundle) return null;
  return <div data-testid="full-plan-card" className="no-print mt-6 rounded-[12px] border-2 border-charcoal bg-white p-5">
    <p className="font-serif text-2xl leading-tight">Your full plan, dated and ready to print</p>
    <p className="mt-2 text-sm leading-6 text-charcoal/70" data-testid="full-plan-line">The free plan dates {FREE_TASK_COUNT} core tasks. The full plan dates {counts ? `${counts.total} tasks` : 'every task'} from your wedding day, with wedding week{counts?.payments ? ` and ${counts.payments} payment tasks` : ' and final payments'}, and a suggested owner for each. It opens right after you pay, with the checklist files.</p>
    <div className="mt-4 grid gap-3">
      <Link href={pdf.route} className="rounded-2xl bg-blue px-6 py-4 text-center font-bold text-white">Get the {pdf.name} — ${pdf.price} ›</Link>
      <Link href={bundle.route} className="rounded-2xl border-2 border-charcoal px-6 py-3 text-center font-bold">Get the {bundle.name} — ${bundle.price} ›</Link>
    </div>
  </div>;
}
