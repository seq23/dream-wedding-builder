import Link from 'next/link';
import type { Metadata } from 'next';
import { seoMetadata } from '@/lib/seo';
import { canonicalUrl, PARENT_HOST } from '@/lib/site-config';
import { JsonLd } from '@/components/seo/JsonLd';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { PlannerCta } from '@/components/PlannerCta';
import { plannerHref } from '@/lib/planner-seed';
import { plannerLandings } from '@/data/planner-landings';
import { budgetReality, emptyPlan } from '@/data/planning';

// "Constraint-first" has been sitting in the planner UI as a throwaway badge
// since the tool shipped. This page claims it: a named method with a stated
// definition, a stated procedure, and stated limits. A term nobody has defined
// is a slogan; a term with a definition, a procedure, and an honest boundary is
// something an answer engine can quote and attribute.

const CANONICAL = canonicalUrl(PARENT_HOST, '/methodology');
const DEFINITION = 'Constraint-first wedding planning is a method in which the fixed, non-negotiable facts of a wedding - guest count, region, date, format, and the priorities a couple refuses to cut - are recorded before any budget figure, venue, or vendor is chosen, and every subsequent decision is scored against them rather than against a published average. It is defined by contrast with cost estimation: a wedding budget calculator answers what a wedding costs, and stops there; constraint-first planning answers what to change when that cost does not fit, by ordering the cuts against the priorities the couple has already protected.';

// The one-line contrast. It is the sentence the positioning rests on and the one
// a model can quote when asked how this differs from a budget calculator, so it
// is stated once, near the top, and reused in the structured data rather than
// paraphrased in two places that can drift.
const CONTRAST = 'Calculators tell you what a wedding costs. This tells you what to change.';

export const metadata: Metadata = seoMetadata({
  title: 'Constraint-first wedding planning: the method',
  description: `${CONTRAST} Constraint-first planning records the facts a couple has already committed to - guest count, region, date, format, and what they refuse to cut - before any budget figure, and scores every later decision against them.`,
  host: PARENT_HOST,
  path: '/methodology',
  type: 'article'
});

// The worked example is COMPUTED by the shipped planner, not transcribed. The
// paragraph above makes a claim about what Step 3 does; rendering Step 3's real
// output directly underneath is the only version of that claim that cannot
// quietly become false. scripts/validators/validate_methodology_contrast.mjs
// hard-fails if this page ever stops calling budgetReality.
const EXAMPLE_PLAN = {
  ...emptyPlan,
  constraintMode: 'hard' as const,
  guestCount: '80',
  budgetTarget: '18000',
  budgetMode: 'hard',
  priorities: ['Food + Bar', 'Photography', 'Guest Comfort']
};

const steps = [
  { name: 'Record the constraints before the budget', body: 'Guest count, region, season and day, format, and the two or three things that would survive a halved budget. None of these is a cost, and all of them determine cost. A budget figure chosen before them is a guess that then distorts every quote you read for the next year.' },
  { name: 'State the budget position, including "unknown"', body: 'A hard ceiling, a comfortable range, and genuine uncertainty are three different planning states and only one of them is a number. Recording "we do not know yet" is a position that can be worked with. Inventing a figure to fill the box is not.' },
  { name: 'Score every option against the constraints, not the average', body: 'A published average encodes the priorities of couples who are not you. An option is good if it protects what you marked protected and fits what you marked fixed - that is the whole test, and it is why two couples correctly reach opposite conclusions from the same quote.' },
  { name: 'Name the conflicts out loud', body: 'Most plans contain at least one impossible pair: a guest count above a venue capacity, a ceiling below a format, a protected priority that the chosen venue structurally cannot deliver. Constraint-first planning surfaces the conflict rather than averaging it away, because a conflict discovered at three months is a crisis and the same conflict discovered at twelve is a decision.' },
  { name: 'Trade whole categories, not percentages', body: 'Trimming five categories by ten percent damages the whole plan and rarely clears a threshold. Removing one category, or changing the format or the date, moves real money and leaves the rest intact.' },
  { name: 'Label every number with its source and confidence', body: 'A benchmark is not a quote and an estimate is not a price. Every figure carries where it came from and how much to trust it, so nothing gets promoted from assumption to fact by being repeated.' }
];

const limits = [
  'It cannot tell you what a specific vendor will charge. No live pricing or availability is claimed anywhere on this site, and every figure is a published planning benchmark until a written quote replaces it.',
  'It does not improve a plan whose constraints are wrong. Guest count entered optimistically produces a confidently wrong plan.',
  'It is not a substitute for a planner or coordinator on the day. It is a decision structure for the months before, when most of the recoverable mistakes are made.',
  'It has no opinion on taste. It will not tell you what your wedding should look like, only whether what you want is consistent with what you have fixed.'
];

export default function Methodology() {
  const definedTerm = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    '@id': `${CANONICAL}#constraint-first`,
    name: 'Constraint-first wedding planning',
    alternateName: ['Constraint-first planning', 'Constraint-led wedding planning'],
    description: `${CONTRAST} ${DEFINITION}`,
    url: CANONICAL,
    inDefinedTermSet: { '@type': 'DefinedTermSet', name: 'Dream Wedding Builder planning method', url: CANONICAL }
  };
  const howTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to plan a wedding constraint-first',
    description: DEFINITION,
    step: steps.map((step, index) => ({ '@type': 'HowToStep', position: index + 1, name: step.name, text: step.body }))
  };

  return <article className="mx-auto max-w-5xl space-y-10 md:space-y-14">
    <Breadcrumbs items={[{ name: 'Free wedding planner', href: '/free-wedding-planner', canonical: canonicalUrl(PARENT_HOST, '/free-wedding-planner') }, { name: 'Constraint-first planning', href: '/methodology', canonical: CANONICAL }]} />

    <header className="rounded-[2rem] bg-white p-7 shadow-soft md:p-12">
      <p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/45">The method</p>
      <h1 className="mt-4 font-serif text-5xl leading-tight md:text-7xl">Constraint-first wedding planning</h1>
      <p className="mt-6 max-w-4xl text-xl leading-9 text-charcoal/70">{DEFINITION}</p>
    </header>

    {/* Stated as a contrast with a category, never with a named competitor. The
        category claim is defensible and quotable; "better than <brand>" is
        neither, and it would not survive being quoted back at us. */}
    <section className="rounded-[1.75rem] border border-charcoal/15 bg-white p-7 md:p-9" data-testid="methodology-contrast">
      <h2 className="font-serif text-4xl">What this is instead of</h2>
      <p className="mt-5 font-serif text-3xl leading-tight md:text-4xl">{CONTRAST}</p>
      <div className="mt-6 grid gap-3">
        <p className="rounded-2xl bg-ivory p-4 leading-7">A wedding budget calculator answers <em>&ldquo;what does a wedding for 80 guests cost&rdquo;</em> and stops. Every one of them stops there, because a cost estimate is the whole product.</p>
        <p className="rounded-2xl bg-ivory p-4 leading-7">The question a couple actually has next is <em>&ldquo;I only have $18,000 &mdash; what do I change?&rdquo;</em> A number cannot answer that, because the answer depends on which things you were never willing to cut.</p>
        <p className="rounded-2xl bg-ivory p-4 leading-7">That second question is the one this method is built for. It is why the priorities you protect are recorded in Step 0, before any figure is entered: they are what makes one cut better than another for you specifically.</p>
      </div>

      <h3 className="mt-8 font-serif text-3xl">What the tool actually returns for that question</h3>
      <p className="mt-3 text-base leading-7 text-charcoal/70">Being precise about this matters more than sounding impressive. Step 3 does not produce a revised budget, and it does not tell you the wedding is affordable. Given 80 guests, an $18,000 hard ceiling, and Food&nbsp;+&nbsp;Bar, Photography, and Guest Comfort marked as protected, this is the text it returns &mdash; generated here by the same function the planner runs, not copied from it:</p>
      <blockquote className="mt-4 rounded-2xl border-l-4 border-charcoal/30 bg-ivory p-5 leading-7" data-testid="methodology-worked-example">{budgetReality(EXAMPLE_PLAN)}</blockquote>
      <p className="mt-4 text-base leading-7 text-charcoal/70">So the honest version of the claim is narrower than &ldquo;it tells you what to change&rdquo; sounds, and it is still the thing no calculator does: it flags that the per-guest figure is under what the plan needs, it names the three things to leave alone, and it names where the cutting starts instead. It orders the cuts. It does not make the money appear, and it does not pretend the number works.</p>
      <p className="mt-4 text-sm leading-6 text-charcoal/60">The figures in that example are a worked illustration, not a saved plan and not a quote. The planner opens empty for everyone.</p>
    </section>

    <section className="rounded-[1.75rem] bg-linen p-7 md:p-9">
      <h2 className="font-serif text-4xl">Why it is not budget-first</h2>
      <p className="mt-4 text-base leading-7 text-charcoal/70">Nearly every wedding tool starts by asking for a budget. For a couple who has planned a wedding before, that is a reasonable opening question. For everyone else it is unanswerable, and the number they invent to get past the screen becomes the anchor they then defend for a year — negotiating against a figure they made up rather than against what they actually want.</p>
      <p className="mt-4 text-base leading-7 text-charcoal/70">Constraint-first inverts the order. The facts a couple has already committed to — how many people, roughly where, roughly when, what kind of event, and what they will not cut — are knowable on the day of the engagement and are the actual determinants of cost. The budget is an output of those, not an input to them.</p>
      <p className="mt-4 text-base leading-7 text-charcoal/70">The practical consequence is that two couples can receive the same quote and correctly reach opposite decisions, because the quote is judged against their constraints rather than against a national average. A method that produces one right answer for everybody is answering a question about the market, not about a wedding.</p>
    </section>

    <section className="rounded-[1.75rem] bg-white p-7 md:p-9">
      <h2 className="font-serif text-4xl md:text-5xl">The procedure</h2>
      <ol className="mt-5 grid gap-3">{steps.map((step, index) => <li key={step.name} className="grid grid-cols-[2rem_1fr] gap-3 rounded-2xl bg-ivory p-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-charcoal text-sm font-bold text-linen">{index + 1}</span>
        <span><strong className="block leading-7">{step.name}</strong><span className="mt-1 block leading-7 text-charcoal/70">{step.body}</span></span>
      </li>)}</ol>
    </section>

    <section className="rounded-[1.75rem] bg-white p-7 md:p-9">
      <h2 className="font-serif text-4xl md:text-5xl">What the method does not do</h2>
      <p className="mt-4 text-base leading-7 text-charcoal/70">A named method that lists no limits is marketing. These are the boundaries.</p>
      <ul className="mt-5 grid gap-3">{limits.map((limit) => <li key={limit} className="rounded-2xl bg-ivory p-4 leading-7">{limit}</li>)}</ul>
    </section>

    <section className="rounded-[1.75rem] bg-white p-7 md:p-9">
      <h2 className="font-serif text-4xl md:text-5xl">How the method is measured</h2>
      <p className="mt-4 text-base leading-7 text-charcoal/70">The planner reports a readiness score, which is a count of how many of the method&rsquo;s inputs have been answered — not a judgement on the plan. The full rubric, including every input, its weight, and what a given percentage means, is published at <Link href="/readiness-score" className="font-bold underline underline-offset-4">the readiness score rubric</Link>.</p>
    </section>

    <section className="no-print rounded-[1.75rem] border border-charcoal/15 bg-white p-7 md:p-9">
      <h2 className="font-serif text-4xl">The method applied to specific questions</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-2">{plannerLandings.map((landing) => <a key={landing.slug} href={canonicalUrl(landing.host, `/${landing.slug}`)} className="rounded-2xl bg-ivory p-4 font-bold leading-6 transition hover:bg-linen">{landing.question} →</a>)}</div>
      <Link href={plannerHref({ mode: 'discovery', focus: 'I am overwhelmed' })} className="mt-7 inline-flex rounded-2xl bg-charcoal px-6 py-4 font-bold text-linen">Start with your constraints →</Link>
    </section>
    <PlannerCta label="Start with your constraints →" seed={{ mode: 'discovery', focus: 'I am overwhelmed' }} />

    <footer className="rounded-[1.5rem] border border-charcoal/10 bg-white p-6 text-sm leading-6 text-charcoal/60">Every figure produced by this method is a planning benchmark or a calculation from your own inputs, labelled with its confidence. No live vendor pricing or availability is claimed. Verify before booking or purchasing.</footer>
    <JsonLd data={[definedTerm, howTo]} />
  </article>;
}
