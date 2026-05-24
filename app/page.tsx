import Link from 'next/link';
import { Card, Badge } from '@/components/Card';

const steps = ['Tell us what you know', 'Discover vision', 'Set budget reality', 'Find venue strategy', 'Build vendor plan', 'Export planner packet'];
const trust = ['Starts blank — no fake Lake Como default', 'Uses user constraints before recommendations', 'Labels estimates, confidence, and verification needs', 'LLM role is reasoning, not inventing prices or availability'];

export default function Home() {
  return <div className="space-y-12">
    <section className="grid gap-8 md:grid-cols-[1.05fr_.95fr] md:items-center">
      <div className="py-10 md:py-20"><p className="mb-4 text-sm font-bold uppercase tracking-[0.25em] text-charcoal/60">No account required · bride-led planning intelligence · planner-ready output</p><h1 className="font-serif text-5xl leading-tight md:text-7xl">Plan the wedding from what you actually know — even if that is almost nothing yet.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-charcoal/75">Dream Wedding Builder helps you discover the vision, pressure-test the budget, think through venue and vendor strategy, label what needs verification, and leave with a packet you can send to a planner or venue.</p><div className="mt-8 flex flex-col gap-3 sm:flex-row"><Link className="rounded-full bg-charcoal px-6 py-4 text-center font-bold text-linen" href="/build">Start the guided builder</Link><Link className="rounded-full border border-charcoal/20 bg-white px-6 py-4 text-center font-bold" href="/methodology">Read methodology</Link></div></div>
      <section className="grid gap-4"><Card><Badge>Guided Flow</Badge><p className="mt-3 font-serif text-3xl">Blank start → planner packet</p><div className="mt-4 flex flex-wrap gap-2">{steps.map((step, index) => <span key={step} className="rounded-full bg-ivory px-3 py-2 text-sm font-bold">{index}. {step}</span>)}</div></Card><Card><p className="text-sm uppercase tracking-wide text-charcoal/50">Estimate status</p><p className="mt-2 font-serif text-4xl">Not estimated yet</p><p className="mt-2 text-sm text-charcoal/70">The app will not show a fake total until you provide at least guest count or budget context.</p></Card><Card><p className="font-serif text-3xl">Trust rules</p><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-charcoal/70">{trust.map(item => <li key={item}>{item}</li>)}</ul></Card></section>
    </section>
  </div>;
}
