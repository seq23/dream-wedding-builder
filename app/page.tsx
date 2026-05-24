import Link from 'next/link';
import { Card, Badge } from '@/components/Card';
import { intelligenceModules, planningBuckets } from '@/data/planning';

export default function HomePage() {
  return <div className="space-y-10">
    <section className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <Badge>Dream Wedding Builder</Badge>
        <h1 className="mt-4 max-w-4xl font-serif text-6xl leading-tight md:text-7xl">A constraint-aware wedding planner brain, not a generic mood-board app.</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-charcoal/70">Start with what you know: Italy, full buyout, sleeps 70–80, outside catering; or nothing at all. The app captures constraints, protects priorities, runs Recommendation Studio, then carries decisions into venues, budget, design, vendors, risks, and the planner packet.</p>
        <div className="mt-6 flex flex-wrap gap-3"><Link className="rounded-full bg-charcoal px-6 py-4 font-bold text-linen" href="/build#step-0">Start with Planning Reality Check</Link><Link data-testid="home-recommendation-studio-cta" className="rounded-full border border-charcoal/20 bg-white px-6 py-4 font-bold" href="/build#step-1">Ask Recommendation Studio</Link><Link className="rounded-full border border-charcoal/20 bg-white px-6 py-4 font-bold" href="/photos">Open Photos Lab</Link></div>
      </div>
      <Card><h2 className="font-serif text-3xl">Use Recommendation Studio when you are stumped.</h2><p className="mt-3 text-sm leading-6 text-charcoal/70">Ask about venues, flowers, colors, budget tradeoffs, guest experience, food, fashion, photo moments, weekend flow, vendor questions, or what you are not thinking about.</p><div className="mt-4 grid gap-2 text-sm"><p className="rounded-2xl bg-white p-3">“I want pink, orange, and yellow flowers.”</p><p className="rounded-2xl bg-white p-3">“Italy, full venue buyout, sleeps 70–80, outside catering.”</p><p className="rounded-2xl bg-white p-3">“Where can I save without hurting flowers and guest comfort?”</p></div></Card>
    </section>

    <section className="grid gap-4 md:grid-cols-3">
      <Card><Badge>Step 0</Badge><h2 className="mt-3 font-serif text-3xl">Constraint Profile</h2><p className="mt-2 text-sm text-charcoal/70">Hard constraints, flexible constraints, or discovery mode. The app changes the fields based on what the user already knows.</p></Card>
      <Card><Badge>Step 1</Badge><h2 className="mt-3 font-serif text-3xl">Recommendation Studio</h2><p className="mt-2 text-sm text-charcoal/70">Open-ended planner recommendations that use saved constraints instead of generic wedding advice.</p></Card>
      <Card><Badge>Output</Badge><h2 className="mt-3 font-serif text-3xl">Planner Packet</h2><p className="mt-2 text-sm text-charcoal/70">Constraint profile, recommendation output, selected venue strategy, budget tradeoffs, design, scope, vendors, and risks.</p></Card>
    </section>

    <section><Badge>Planner-grade buckets</Badge><h2 className="mt-4 font-serif text-4xl">The right planning surface area.</h2><div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{planningBuckets.map(bucket => <Card key={bucket} className="shadow-none"><p className="font-bold">{bucket}</p></Card>)}</div></section>

    <section><Badge>Usable modules</Badge><div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{intelligenceModules.map(module => <p key={module} className="rounded-2xl bg-white p-4 text-sm font-bold shadow-soft">{module}</p>)}</div></section>
  </div>;
}
