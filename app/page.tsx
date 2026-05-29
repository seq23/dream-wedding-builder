import Link from 'next/link';
import { Card, Badge } from '@/components/Card';
import { intelligenceModules, planningBuckets } from '@/data/planning';

const trustMarkers = [
  'Seeded examples only',
  'No live availability claimed',
  'Verify before booking',
  'Assumptions carried into packet'
];

const workflow = [
  ['Step 0', 'Reality Check', 'Capture the constraints that make the wedding real: location, guest count, lodging, catering freedom, budget comfort, and priorities.'],
  ['Step 1', 'Planner Brain', 'Ask the recommendation studio for grounded directions when the planning question is messy or still incomplete.'],
  ['Step 2+', 'Strategy to Packet', 'Carry the decisions through venue, budget, design, vendors, ideas, and a planner-ready working brief.']
];

export default function HomePage() {
  return <div className="space-y-14">
    <section className="relative overflow-hidden rounded-[2rem] border border-charcoal/10 bg-linen p-6 shadow-soft md:p-10">
      <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-l from-champagne/30 to-transparent lg:block" aria-hidden />
      <div className="relative grid gap-10 lg:grid-cols-[1fr_420px]">
        <div>
          <Badge>Dream Wedding Builder</Badge>
          <p className="mt-6 max-w-xl font-serif text-2xl italic leading-9 text-charcoal/70">Dear bride, this is how you stop planning from fantasy and start planning from reality.</p>
          <h1 className="mt-5 max-w-4xl font-serif text-6xl leading-tight md:text-7xl">A constraint-aware wedding planner brain for the wedding you actually have to execute.</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-charcoal/70">Start with what you know: Italy, full buyout, sleeps 70–80, outside catering; or nothing at all. The app captures constraints, protects priorities, runs the Planner Brain, then carries decisions into venues, budget, design, vendors, risks, and the planner packet.</p>
          <div className="mt-7 flex flex-wrap gap-3"><Link className="rounded-full bg-charcoal px-6 py-4 font-bold text-linen" href="/build#step-0">Start with Planning Reality Check</Link><Link data-testid="home-recommendation-studio-cta" className="rounded-full border border-charcoal/20 bg-white px-6 py-4 font-bold" href="/build#step-1">Ask Recommendation Studio</Link></div>
          <div className="mt-7 flex flex-wrap gap-2" aria-label="Trust markers">{trustMarkers.map(marker => <span key={marker} className="rounded-full border border-charcoal/10 bg-ivory px-3 py-2 text-xs font-bold text-charcoal/65">{marker}</span>)}</div>
        </div>
        <Card className="relative bg-ivory/80 shadow-none">
          <p className="text-xs uppercase tracking-[0.35em] text-charcoal/50">Planner table preview</p>
          <h2 className="mt-4 font-serif text-4xl">What you leave with</h2>
          <div className="mt-6 space-y-3 text-sm">
            <p className="rounded-2xl bg-white p-4"><strong>Constraint profile:</strong> the real rules, unknowns, and non-negotiables.</p>
            <p className="rounded-2xl bg-white p-4"><strong>Venue strategy:</strong> match logic, lodging assumptions, catering freedom, and verification notes.</p>
            <p className="rounded-2xl bg-white p-4"><strong>Planner packet:</strong> budget range, design language, vendor questions, risks, and next decisions.</p>
          </div>
          <Link className="mt-6 inline-flex rounded-full border border-charcoal/20 bg-white px-5 py-3 font-bold" href="/photos">Open Photos Lab</Link>
        </Card>
      </div>
    </section>

    <section className="grid gap-4 md:grid-cols-3">
      {workflow.map(([step, title, copy]) => <article key={title} className="border-t border-charcoal/20 pt-5"><Badge>{step}</Badge><h2 className="mt-3 font-serif text-3xl">{title}</h2><p className="mt-2 text-sm leading-6 text-charcoal/70">{copy}</p></article>)}
    </section>

    <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
      <div><Badge>Planner-grade buckets</Badge><h2 className="mt-4 font-serif text-5xl leading-tight">The planning surface area has to match the stakes.</h2><p className="mt-4 leading-7 text-charcoal/70">A mood board can inspire. A planner packet has to make decisions safer. This system keeps budget, lodging, vendors, photos, flowers, guest comfort, and verification caveats in the same working plan.</p></div>
      <div className="grid gap-3 md:grid-cols-2">{planningBuckets.map(bucket => <Card key={bucket} className="bg-white/80 shadow-none"><p className="font-bold">{bucket}</p></Card>)}</div>
    </section>

    <section className="rounded-[2rem] bg-charcoal p-6 text-linen md:p-8"><Badge>Useful modules</Badge><div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{intelligenceModules.map(module => <p key={module} className="rounded-2xl border border-linen/15 bg-linen/10 p-4 text-sm font-bold">{module}</p>)}</div></section>
  </div>;
}
