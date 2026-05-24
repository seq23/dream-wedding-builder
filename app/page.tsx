import Link from 'next/link';
import { Card, Badge } from '@/components/Card';

const steps = ['Vision', 'Budget', 'Priorities', 'Trends', 'Photo', 'Pricing', 'Packet'];

export default function Home() {
  return <div className="space-y-12">
    <section className="grid gap-8 md:grid-cols-[1.05fr_.95fr] md:items-center">
      <div className="py-10 md:py-20"><p className="mb-4 text-sm font-bold uppercase tracking-[0.25em] text-charcoal/60">No account required · guided workbook · planner-ready output</p><h1 className="font-serif text-5xl leading-tight md:text-7xl">Build your dream wedding without opening twelve tabs.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-charcoal/75">Start with a calm step-by-step planner. Define the look, choose budget behavior, pick trend moments, price photo inspiration, compare tradeoffs, and leave with a printable Dream Wedding Starter Pack.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link className="rounded-full bg-charcoal px-6 py-4 text-center font-bold text-linen" href="/build">Start Step 1</Link><Link className="rounded-full border border-charcoal/20 bg-white px-6 py-4 text-center font-bold" href="/build#step-4">Jump to trends</Link></div></div>
      <section className="grid gap-4"><Card><Badge>Guided Flow</Badge><p className="mt-3 font-serif text-3xl">Step 1 → Step 7</p><div className="mt-4 flex flex-wrap gap-2">{steps.map((step, index) => <span key={step} className="rounded-full bg-ivory px-3 py-2 text-sm font-bold">{index + 1}. {step}</span>)}</div></Card><Card><p className="text-sm uppercase tracking-wide text-charcoal/50">Estimated total</p><p className="mt-2 font-serif text-4xl">$118k–$165k</p><p className="mt-2 text-sm text-charcoal/70">Live pricing updates as you add trends, products, and levers.</p></Card><Card><p className="font-serif text-3xl">Dream Wedding Starter Pack</p><p className="mt-2 text-sm text-charcoal/70">Print pricing, vendor questions, selected moments, photo notes, and disclaimers.</p></Card></section>
    </section>
  </div>;
}
