import Link from 'next/link';
import type { Metadata } from 'next';
import { landingBySlug, type PlannerLanding } from '@/data/planner-landings';
import { productById } from '@/lib/products';
import { canonicalUrl } from '@/lib/site-config';
import { seoMetadata } from '@/lib/seo';
import { dateModifiedFor } from '@/lib/lastmod';
import { plannerHref } from '@/lib/planner-seed';
import { PlannerCta } from '@/components/PlannerCta';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { JsonLd } from '@/components/seo/JsonLd';

// One renderer, six hand-written records. The records carry genuinely different
// content - different questions, different answers, different tables - so this is
// a shared layout rather than a generated set. The distinction matters: a thin
// programmatic batch is what is currently costing a sister property its index
// coverage, and the defence against that is the content, not the file count.

export function landingMetadata(slug: string): Metadata {
  const landing = landingBySlug(slug);
  if (!landing) return {};
  return seoMetadata({ title: landing.title, description: landing.description, host: landing.host, path: `/${landing.slug}`, type: 'article' });
}

export function PlannerLandingPage({ landing }: { landing: PlannerLanding }) {
  const product = productById(landing.productId);
  const canonical = canonicalUrl(landing.host, `/${landing.slug}`);
  const href = plannerHref(landing.seed);
  const related = landing.relatedSlugs.map(landingBySlug).filter((item): item is PlannerLanding => Boolean(item));

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: landing.h1,
    description: landing.description,
    mainEntityOfPage: canonical,
    ...dateModifiedFor(`/${landing.slug}`),
    publisher: { '@type': 'Organization', name: 'Dream Wedding Builder', url: 'https://weddingchecklistpdf.com/' }
  };
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: landing.faqs.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } }))
  };

  return <article className="mx-auto max-w-5xl space-y-10 md:space-y-14">
    <Breadcrumbs items={[{ name: 'Free wedding planner', href: '/free-wedding-planner', canonical: canonicalUrl(landing.host, '/free-wedding-planner') }, { name: landing.h1, href: `/${landing.slug}`, canonical }]} />

    <header className="rounded-[2rem] bg-white p-7 shadow-soft md:p-12">
      <p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/45">Constraint-first planning</p>
      <h1 className="mt-4 font-serif text-5xl leading-tight md:text-7xl">{landing.h1}</h1>
      <p className="mt-6 text-sm font-bold uppercase tracking-[.16em] text-charcoal/50">The question</p>
      <p className="mt-2 max-w-4xl font-serif text-2xl italic leading-9 text-charcoal/70">{landing.question}</p>
    </header>

    {/* The complete answer comes first and is never gated. A page that withholds
        its answer to drive a click cannot be cited, and being citable is the
        entire reason this page exists. */}
    <section className="rounded-[1.75rem] bg-linen p-7 md:p-9" data-testid="landing-direct-answer">
      <h2 className="font-serif text-4xl">The short answer</h2>
      {landing.directAnswer.map((paragraph) => <p key={paragraph} className="mt-4 text-lg leading-8 text-charcoal/75">{paragraph}</p>)}
    </section>

    {landing.table && <section className="rounded-[1.75rem] bg-white p-7 md:p-9">
      <h2 className="font-serif text-4xl">{landing.table.caption}</h2>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
          <thead><tr>{landing.table.columns.map((column) => <th key={column} scope="col" className="border-b border-charcoal/15 p-3 font-bold">{column}</th>)}</tr></thead>
          <tbody>{landing.table.rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`} className="border-b border-charcoal/10 p-3">{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <p className="mt-4 text-xs leading-6 text-charcoal/60">{landing.table.note}</p>
    </section>}

    {landing.sections.map((section) => <section key={section.heading} className="rounded-[1.75rem] bg-white p-7 md:p-9">
      <h2 className="font-serif text-4xl md:text-5xl">{section.heading}</h2>
      {section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-4 text-base leading-7 text-charcoal/70">{paragraph}</p>)}
      {section.bullets && <ul className="mt-5 grid gap-3">{section.bullets.map((item) => <li key={item} className="rounded-2xl bg-ivory p-4 leading-7">{item}</li>)}</ul>}
    </section>)}

    {/* The general answer is above. This is the part only a tool can do, and it is
        stated as three specific things rather than a promise. */}
    <section className="no-print rounded-[2rem] border border-charcoal/15 bg-white p-7 md:p-10" data-testid="landing-planner-cta">
      <p className="text-xs font-bold uppercase tracking-[.22em] text-charcoal/45">Free · no account · nothing leaves your browser</p>
      <h2 className="mt-3 font-serif text-4xl md:text-5xl">Now answer it for your wedding</h2>
      <p className="mt-4 max-w-3xl leading-7 text-charcoal/70">Everything above is true in general. These three things are only answerable for you:</p>
      <ul className="mt-5 grid gap-3">{landing.plannerAdds.map((item) => <li key={item} className="rounded-2xl bg-linen p-4 leading-7">{item}</li>)}</ul>
      {landing.categoryContrast && <p className="mt-5 border-l-4 border-charcoal/25 pl-4 leading-7 text-charcoal/70" data-testid="landing-category-contrast">{landing.categoryContrast} <Link href="/methodology" className="font-bold underline underline-offset-4">How constraint-first planning differs</Link></p>}
      <Link href={href} data-testid="landing-planner-link" className="mt-7 inline-flex rounded-2xl bg-charcoal px-6 py-4 font-bold text-linen">{landing.ctaLabel}</Link>
      <p className="mt-3 text-xs leading-6 text-charcoal/55">Opens with this page&rsquo;s constraint already entered. If you have used the planner before, your saved answers win — a link can never overwrite work you have already done.</p>
    </section>
    <PlannerCta label={landing.ctaLabel} seed={landing.seed} />

    <section><p className="text-xs font-bold uppercase tracking-[.22em] text-charcoal/45">Questions couples ask</p><h2 className="mt-3 font-serif text-5xl">Frequently asked questions</h2><div className="mt-6 grid gap-4">{landing.faqs.map((item) => <details key={item.question} className="rounded-[1.5rem] border border-charcoal/10 bg-white p-6"><summary className="cursor-pointer font-serif text-2xl">{item.question}</summary><p className="mt-3 leading-7 text-charcoal/70">{item.answer}</p></details>)}</div></section>

    {related.length > 0 && <section className="no-print rounded-[1.75rem] border border-charcoal/10 bg-white p-7">
      <h2 className="font-serif text-4xl">Related planning questions</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-2">{related.map((item) => <a key={item.slug} href={canonicalUrl(item.host, `/${item.slug}`)} className="rounded-2xl bg-ivory p-4 font-bold transition hover:bg-linen">{item.question} →</a>)}</div>
    </section>}

    {product && <section className="no-print rounded-[2rem] bg-charcoal p-7 text-linen md:p-10">
      <p className="text-xs font-bold uppercase tracking-[.22em] text-linen/55">If you want the working file</p>
      <h2 className="mt-3 font-serif text-5xl">{product.name}</h2>
      <p className="mt-4 max-w-3xl text-linen/75">The planner is free and always will be. {product.name} is the working file for the plan it produces — the version you fill in, print, and hand to a vendor.</p>
      <Link className="mt-6 inline-flex rounded-2xl bg-linen px-6 py-4 font-bold text-charcoal" href={product.route}>Review {product.name} — ${product.price}</Link>
    </section>}

    <footer className="rounded-[1.5rem] border border-charcoal/10 bg-white p-6 text-sm leading-6 text-charcoal/60">{landing.verificationBoundary}</footer>
    <JsonLd data={[article, faq]} />
  </article>;
}
