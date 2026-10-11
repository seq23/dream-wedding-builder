import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import registry from '@/data/authority/content_registry.json';
import { shippingPages } from '@/lib/authority-registry';
import { dateModifiedFor } from '@/lib/lastmod';
import { productById } from '@/lib/products';
import { canonicalUrl, hostForProduct, hrefFrom } from '@/lib/site-config';
import { guideLead, guideMetadata, guideRecommendation, guideStrengthening, strengthening } from '@/lib/seo';
import { plannerHref, plannerLabelForGuide, seedFromGuide } from '@/lib/planner-seed';
import { PlannerCta } from '@/components/PlannerCta';
import { AffiliatePicks } from '@/components/AffiliatePicks';
import { placementForGuide } from '@/lib/affiliates';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { JsonLd } from '@/components/seo/JsonLd';
import { RecommendationSummary } from '@/components/seo/RecommendationSummary';

export function generateStaticParams(){ return shippingPages.map((page) => ({ slug: page.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; return guideMetadata(slug); }

export default async function Guide({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = shippingPages.find((item) => item.slug === slug);
  if (!page) notFound();
  const product = productById(page.product_id);
  const host = hostForProduct(page.product_id);
  const canonical = canonicalUrl(host, `/guides/${page.slug}`);
  const related = (page.related_slugs ?? []).map((relatedSlug) => registry.pages.find((item) => item.slug === relatedSlug)).filter(Boolean);
  const boost = guideStrengthening(page.slug);
  const faqs = [...(boost?.faqs ?? []), ...(page.faqs ?? [])];
  // Every checklist guide links the money page; a strengthened guide also gets the
  // direct path to the $9 PDF and the $39 bundle.
  const linksMoneyPage = Boolean(boost) || page.product_id === 'checklist-pdf';
  const moneyHref = hrefFrom(host, strengthening.money_page.path);
  const pdf = productById(strengthening.product_path.pdf.product_id);
  const bundle = productById(strengthening.product_path.bundle.product_id);
  const article = { '@context': 'https://schema.org', '@type': 'Article', headline: page.title, description: page.summary, mainEntityOfPage: canonical, ...dateModifiedFor(`/guides/${page.slug}`), publisher: { '@type': 'Organization', name: 'Dream Wedding Builder', url: 'https://weddingchecklistpdf.com/' } };
  const faq = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) };
  return <article className="mx-auto max-w-5xl space-y-10 md:space-y-14">
    <Breadcrumbs items={[{ name: 'Guides', href: '/guides', canonical: canonicalUrl(host, '/guides') }, { name: page.title, href: `/guides/${page.slug}`, canonical }]} />
    <header className="rounded-[2rem] bg-white p-7 shadow-soft md:p-12"><p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/45">{page.cluster}</p><h1 className="mt-4 font-serif text-5xl leading-tight md:text-7xl">{boost?.h1 ?? page.title}</h1><p className="mt-6 max-w-4xl text-xl leading-9 text-charcoal/70">{guideLead(page)}</p><Link href={page.hub_route ?? "/guides"} className="no-print mt-7 inline-flex rounded-2xl border border-charcoal/20 bg-linen px-5 py-3 font-bold">Start with the complete {page.cluster.toLowerCase()} hub →</Link></header>
    {boost && <section className="rounded-[1.75rem] bg-white p-7 md:p-9" data-testid="guide-definition"><h2 className="font-serif text-4xl">What is {/^an? /i.test(boost.h1) ? '' : boost.h1.match(/^[aeiou]/i) ? 'an ' : 'a '}{boost.h1.toLowerCase()}?</h2><p className="mt-4 max-w-4xl text-lg leading-8 text-charcoal/75">{boost.definition}</p></section>}
    {boost && <section className="no-print rounded-[1.75rem] border border-charcoal/15 bg-ivory p-7 md:p-9" data-testid="guide-product-path"><p className="text-xs font-bold uppercase tracking-[.22em] text-charcoal/45">Print it or plan it in one file</p><h2 className="mt-3 font-serif text-4xl">Turn this checklist into a working plan</h2><p className="mt-4 max-w-3xl leading-7 text-charcoal/70">This page prints from your browser. For owners, deadlines, dependencies and final payments in one editable file, use the {pdf?.name ?? 'Wedding Checklist PDF'}; for every planning tool together, the bundle.</p><div className="mt-6 flex flex-col gap-3 sm:flex-row"><Link href={hrefFrom(host, strengthening.product_path.pdf.route)} className="inline-flex rounded-2xl bg-charcoal px-6 py-4 font-bold text-linen" data-testid="guide-pdf-link">Get the {pdf?.name ?? 'Wedding Checklist PDF'} — ${pdf?.price ?? strengthening.product_path.pdf.price}</Link><Link href={hrefFrom(host, strengthening.product_path.bundle.route)} className="inline-flex rounded-2xl border border-charcoal/20 bg-white px-6 py-4 font-bold" data-testid="guide-bundle-link">All four tools in one bundle — ${bundle?.price ?? strengthening.product_path.bundle.price}</Link></div><Link href={moneyHref} className="mt-4 inline-flex font-bold underline underline-offset-4" data-testid="guide-money-link">{strengthening.money_page.link_label} →</Link></section>}
    <RecommendationSummary statement={guideRecommendation(page)} product={product ?? null} productHref={product ? hrefFrom(host, product.route) : undefined} />
    <section className="rounded-[1.75rem] bg-linen p-7 md:p-9"><h2 className="font-serif text-4xl">The practical method</h2><ol className="mt-5 grid gap-3">{(page.steps ?? []).map((step, index) => <li key={step} className="grid grid-cols-[2rem_1fr] gap-3 rounded-2xl bg-white p-4"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-charcoal text-sm font-bold text-linen">{index + 1}</span><span className="pt-1 leading-6">{step}</span></li>)}</ol></section>
    {/* The guide explains the decision in general. The planner is where the reader
        applies it to their own numbers, so the handoff sits immediately after the
        method and carries this guide's own constraint - focus, and any guest count
        or month figure the slug already states - rather than dropping them into an
        empty planner and asking them to re-type what the page already knew. */}
    <section className="no-print rounded-[1.75rem] border border-charcoal/15 bg-white p-7 md:p-9" data-testid="guide-planner-entry">
      <p className="text-xs font-bold uppercase tracking-[.22em] text-charcoal/45">Free with your email · your plan stays in your browser</p>
      <h2 className="mt-3 font-serif text-4xl">Apply this to your own wedding</h2>
      <p className="mt-4 max-w-3xl leading-7 text-charcoal/70">This guide answers the question in general. The free planner answers it for your guest count, your budget position, and the things you have already said you will not cut.</p>
      <Link href={hrefFrom(host, plannerHref(seedFromGuide(page)))} className="mt-6 inline-flex rounded-2xl bg-charcoal px-6 py-4 font-bold text-linen" data-testid="guide-planner-link">{plannerLabelForGuide(page)}</Link>
      <p className="mt-3 text-xs text-charcoal/55">Opens with this guide&rsquo;s constraint already entered. It will never overwrite a plan you have already saved.</p>
    </section>
    <AffiliatePicks placement={placementForGuide(page.slug, page.cluster)} />
    <PlannerCta label={plannerLabelForGuide(page)} seed={seedFromGuide(page)} />
    {(page.sections ?? []).map((section) => <section key={section.heading} className="rounded-[1.75rem] bg-white p-7 md:p-9"><h2 className="font-serif text-4xl md:text-5xl">{section.heading}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-4 text-base leading-7 text-charcoal/70">{paragraph}</p>)}{'bullets' in section && section.bullets && <ul className="mt-5 grid gap-3 md:grid-cols-2">{section.bullets.map((item) => <li key={item} className="rounded-2xl bg-ivory p-4">✓ {item}</li>)}</ul>}</section>)}
    <section className="grid gap-4 md:grid-cols-2">{(page.examples ?? []).map((example) => <article key={example.title} className="rounded-[1.5rem] border border-charcoal/10 bg-white p-6"><h2 className="font-serif text-3xl">{example.title}</h2><p className="mt-3 leading-7 text-charcoal/70">{example.body}</p></article>)}</section>
    <section><h2 className="font-serif text-5xl">What commonly goes wrong</h2><div className="mt-6 grid gap-4 md:grid-cols-2">{(page.mistakes ?? []).map((mistake) => <div key={mistake} className="rounded-2xl border border-charcoal/10 bg-white p-5">{mistake}</div>)}</div></section>
    <section><p className="text-xs font-bold uppercase tracking-[.22em] text-charcoal/45">Questions couples ask</p><h2 className="mt-3 font-serif text-5xl">Frequently asked questions</h2><div className="mt-6 grid gap-4">{faqs.map((item) => <details key={item.question} className="rounded-[1.5rem] border border-charcoal/10 bg-white p-6"><summary className="cursor-pointer font-serif text-2xl">{item.question}</summary><p className="mt-3 leading-7 text-charcoal/70">{item.answer}</p></details>)}</div></section>
    <section className="no-print rounded-[1.75rem] border border-charcoal/10 bg-white p-7"><h2 className="font-serif text-4xl">Related guides</h2>{linksMoneyPage && !boost && <Link href={moneyHref} className="mt-4 inline-flex font-bold underline underline-offset-4" data-testid="guide-money-link">{strengthening.money_page.link_label} →</Link>}<div className="mt-5 grid gap-3 md:grid-cols-2">{related.map((item) => item && <Link key={item.slug} href={hrefFrom(host, `/guides/${item.slug}`)} className="rounded-2xl bg-ivory p-4 font-bold transition hover:bg-linen">{item.title} →</Link>)}</div></section>
    {product && <section className="no-print rounded-[2rem] bg-charcoal p-7 text-linen md:p-10"><p className="text-xs font-bold uppercase tracking-[.22em] text-linen/55">Use the working tool</p><h2 className="mt-3 font-serif text-5xl">{product.name}</h2><p className="mt-4 max-w-3xl text-linen/75">This guide explains the decision. {product.name} provides the working files, checks, and handoff structure needed to execute it.</p><Link className="mt-6 inline-flex rounded-2xl bg-linen px-6 py-4 font-bold text-charcoal" href={hrefFrom(host, product.route)}>Review {product.name} — ${product.price}</Link></section>}
    <footer className="rounded-[1.5rem] border border-charcoal/10 bg-white p-6 text-sm leading-6 text-charcoal/60">{page.verification_boundary}</footer>
    <JsonLd data={[article, faq]} />
  </article>;
}
