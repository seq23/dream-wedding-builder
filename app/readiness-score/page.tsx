import Link from 'next/link';
import type { Metadata } from 'next';
import { seoMetadata } from '@/lib/seo';
import { canonicalUrl, PARENT_HOST } from '@/lib/site-config';
import { JsonLd } from '@/components/seo/JsonLd';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { PlannerCta } from '@/components/PlannerCta';
import { plannerHref } from '@/lib/planner-seed';
import { readinessBands, readinessChecks, READINESS_CHECK_COUNT, READINESS_POINTS_PER_CHECK } from '@/lib/readiness';

// The rubric is rendered FROM lib/readiness.ts, not restated alongside it.
// A published rubric and a shipped scorer that are maintained separately will
// disagree within a month, and a page that describes a score incorrectly is worse
// than no page. scripts/validators/validate_readiness_rubric.mjs hard-fails if
// this page ever stops importing the module it documents.

const CANONICAL = canonicalUrl(PARENT_HOST, '/readiness-score');
const DEFINITION = `The planning readiness score is a percentage measuring how many of ${READINESS_CHECK_COUNT} constraint-first planning inputs a couple has answered. Each input carries equal weight, so every answered input moves the score by about ${Math.round(READINESS_POINTS_PER_CHECK)} percentage points. It measures completeness of inputs, not the quality of the plan.`;

export const metadata: Metadata = seoMetadata({
  title: 'The planning readiness score: inputs, weights, and what each number means',
  description: DEFINITION,
  host: PARENT_HOST,
  path: '/readiness-score',
  type: 'article'
});

export default function ReadinessScore() {
  const definedTerm = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    '@id': `${CANONICAL}#planning-readiness-score`,
    name: 'Planning readiness score',
    alternateName: ['Wedding planning readiness score', 'Readiness score'],
    description: DEFINITION,
    url: CANONICAL,
    inDefinedTermSet: { '@type': 'DefinedTermSet', name: 'Dream Wedding Builder planning method', url: canonicalUrl(PARENT_HOST, '/methodology') }
  };
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'Why does a brand-new plan already show 11%?', acceptedAnswer: { '@type': 'Answer', text: 'The budget-position input opens on "I have no idea what weddings cost", which is a real, workable answer rather than a blank. One of nine inputs answered rounds to 11%. Nothing has been assumed on your behalf.' } },
      { '@type': 'Question', name: 'What does 70% readiness mean?', acceptedAnswer: { '@type': 'Answer', text: 'Roughly six or seven of nine inputs are answered. In practice that means location, guest count, budget position, protected priorities, and a recommendation are all on record - the point at which sending vendor inquiries stops wasting your time.' } },
      { '@type': 'Question', name: 'Does a higher readiness score mean a better wedding plan?', acceptedAnswer: { '@type': 'Answer', text: 'No. The score counts answered inputs. It makes no judgement about whether the answers are good ones, and a fully answered plan built on an unrealistic guest count will score 100%.' } },
      { '@type': 'Question', name: 'Are the inputs weighted differently?', acceptedAnswer: { '@type': 'Answer', text: 'No. All nine carry equal weight. Weighting them would require asserting that one input matters more for every couple, which contradicts the constraint-first method the score belongs to.' } }
    ]
  };

  return <article className="mx-auto max-w-5xl space-y-10 md:space-y-14">
    <Breadcrumbs items={[{ name: 'Constraint-first planning', href: '/methodology', canonical: canonicalUrl(PARENT_HOST, '/methodology') }, { name: 'Readiness score', href: '/readiness-score', canonical: CANONICAL }]} />

    <header className="rounded-[2rem] bg-white p-7 shadow-soft md:p-12">
      <p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/45">The rubric</p>
      <h1 className="mt-4 font-serif text-5xl leading-tight md:text-7xl">The planning readiness score</h1>
      <p className="mt-6 max-w-4xl text-xl leading-9 text-charcoal/70">{DEFINITION}</p>
    </header>

    <section className="rounded-[1.75rem] bg-linen p-7 md:p-9">
      <h2 className="font-serif text-4xl">How it is calculated</h2>
      <p className="mt-4 text-base leading-7 text-charcoal/70">Count the answered inputs, divide by {READINESS_CHECK_COUNT}, multiply by 100, round to the nearest whole number. There is no other term in the formula. Every input carries the same weight — about {Math.round(READINESS_POINTS_PER_CHECK)} points — because weighting them would mean asserting that one input matters more for every couple, and that is exactly the assertion <Link href="/methodology" className="font-bold underline underline-offset-4">constraint-first planning</Link> refuses to make.</p>
      <p className="mt-4 text-base leading-7 text-charcoal/70">The score is computed in your browser from values you typed. Nothing is sent anywhere, and no input is inferred on your behalf.</p>
    </section>

    <section className="rounded-[1.75rem] bg-white p-7 md:p-9">
      <h2 className="font-serif text-4xl md:text-5xl">The {READINESS_CHECK_COUNT} scored inputs</h2>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead><tr>
            <th scope="col" className="border-b border-charcoal/15 p-3 font-bold">Input</th>
            <th scope="col" className="border-b border-charcoal/15 p-3 font-bold">What it asks</th>
            <th scope="col" className="border-b border-charcoal/15 p-3 font-bold">Counts when you have answered</th>
            <th scope="col" className="border-b border-charcoal/15 p-3 font-bold">Weight</th>
          </tr></thead>
          <tbody>{readinessChecks.map((check) => <tr key={check.id}>
            <td className="border-b border-charcoal/10 p-3 font-bold">{check.label}</td>
            <td className="border-b border-charcoal/10 p-3">{check.question}</td>
            <td className="border-b border-charcoal/10 p-3">{check.fields.join(' or ')}</td>
            <td className="border-b border-charcoal/10 p-3">{Math.round(READINESS_POINTS_PER_CHECK)}%</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="mt-6 grid gap-3">{readinessChecks.map((check) => <p key={check.id} className="rounded-2xl bg-ivory p-4 leading-7"><strong>{check.label}.</strong> {check.why}</p>)}</div>
    </section>

    <section className="rounded-[1.75rem] bg-white p-7 md:p-9">
      <h2 className="font-serif text-4xl md:text-5xl">What each number means</h2>
      <div className="mt-5 grid gap-3">{readinessBands.map((band) => <p key={band.name} className="rounded-2xl bg-ivory p-4 leading-7"><strong>{band.min}–{band.max}% · {band.name}.</strong> {band.meaning}</p>)}</div>
    </section>

    <section className="rounded-[1.75rem] bg-white p-7 md:p-9">
      <h2 className="font-serif text-4xl md:text-5xl">What the score is not</h2>
      <ul className="mt-5 grid gap-3">
        <li className="rounded-2xl bg-ivory p-4 leading-7">It is not a quality judgement. A plan built on an unrealistic guest count will happily reach 100%.</li>
        <li className="rounded-2xl bg-ivory p-4 leading-7">It is not a prediction. It says nothing about whether the wedding will come in on budget.</li>
        <li className="rounded-2xl bg-ivory p-4 leading-7">It is not a progress bar for the wedding. Answering all nine inputs is the start of vendor conversations, not the end of planning.</li>
        <li className="rounded-2xl bg-ivory p-4 leading-7">It is not comparable between couples. Two plans at 55% can be at completely different stages, because the inputs they answered are different.</li>
      </ul>
    </section>

    <section className="no-print rounded-[1.75rem] border border-charcoal/15 bg-white p-7 md:p-9">
      <h2 className="font-serif text-4xl">See your own score</h2>
      <p className="mt-4 max-w-3xl leading-7 text-charcoal/70">The planner shows your readiness score, which inputs are still unanswered, and what answering each one would change. Free, no account, and everything stays in your browser.</p>
      <Link href={plannerHref({})} className="mt-6 inline-flex rounded-2xl bg-charcoal px-6 py-4 font-bold text-linen">Open the free wedding planner →</Link>
    </section>
    <PlannerCta label="See your readiness score →" seed={{}} />

    <footer className="rounded-[1.5rem] border border-charcoal/10 bg-white p-6 text-sm leading-6 text-charcoal/60">This page is rendered directly from the same module the planner scores with, so the published rubric and the shipped calculation cannot drift apart. Figures elsewhere on this site are planning benchmarks, not quotes; verify before booking or purchasing.</footer>
    <JsonLd data={[definedTerm, faq]} />
  </article>;
}
