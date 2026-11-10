// The end of the free plan (her yes, 7 Nov 2026: "4 yes"; prices approved 6 Nov 2026).
// The free plan stays as it is; this card says the full plan exists and sells it through the
// existing checkout pages. Counts and prices come from the plan windows and the catalog, never
// typed. The app line is left out until the app is in the stores.
import Link from 'next/link';
import { PLAN_WINDOWS } from '@/lib/dated-plan';
import { productById } from '@/lib/products';

export const FREE_TASK_COUNT = PLAN_WINDOWS.reduce((n, w) => n + w.tasks.length, 0);
export const FULL_TASK_COUNT = 104;

export function FullPlanCard() {
  const pdf = productById('checklist-pdf');
  const bundle = productById('operations-suite');
  if (!pdf || !bundle) return null;
  return <div data-testid="full-plan-card" className="no-print mt-6 rounded-[12px] border-2 border-charcoal bg-white p-5">
    <p className="font-serif text-2xl leading-tight">The free plan dates {FREE_TASK_COUNT} core tasks. The {pdf.name} is a {FULL_TASK_COUNT}-row checklist.</p>
    <p className="mt-2 text-sm text-charcoal/65">It is a file you fill in yourself: owners, dependencies, final payments and a 13-page printable packet. Your dates here are not carried into it.</p>
    <div className="mt-4 grid gap-3">
      <Link href={pdf.route} className="rounded-2xl bg-blue px-6 py-4 text-center font-bold text-white">Get the {pdf.name} — ${pdf.price} ›</Link>
      <Link href={bundle.route} className="rounded-2xl border-2 border-charcoal px-6 py-3 text-center font-bold">Get the {bundle.name} — ${bundle.price} ›</Link>
    </div>
  </div>;
}
