import { ConsolidatedDecisions } from '@/components/seo/ConsolidatedDecisions';
import seeds from '@/data/authority/editorial_seeds.json';
import { editorialShape, editorialArticleFields, EditorialEvidence } from '@/components/seo/EditorialEvidence';
import { budgetShape, budgetArticleFields, BudgetEvidence } from '@/components/seo/BudgetEvidence';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { shippingPages } from '@/lib/authority-registry';
import { dateModifiedFor } from '@/lib/lastmod';
import { productById } from '@/lib/products';
import { canonicalUrl, hostForProduct, hrefFrom } from '@/lib/site-config';
import { ORGANIZATION_ID } from '@/lib/site-home';
import { guideLead, guideMetadata, guideMetaDescription, guideRecommendation, guideStrengthening, strengthening } from '@/lib/seo';
import { plannerHref, plannerLabelForGuide, seedFromGuide } from '@/lib/planner-seed';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { JsonLd } from '@/components/seo/JsonLd';
import { questionHeading } from '@/lib/question-heading';

export function generateStaticParams(){ return shippingPages.map((page) => ({ slug: page.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; return guideMetadata(slug); }

export default async function Guide({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = shippingPages.find((item) => item.slug === slug);
  if (!page) notFound();
  const product = productById(page.product_id);
  const host = hostForProduct(page.product_id);
  const canonical = canonicalUrl(host, `/guides/${page.slug}`);
  const related = (page.related_slugs ?? []).map((slug) => ({ slug, title: shippingPages.find(item => item.slug === slug)?.title ?? seeds.seeds.find(item => item.slug === slug)?.title ?? slug.replaceAll('-', ' ') }));
  const shape = budgetShape(page.slug);
  const editorial = editorialShape(page.slug);
  const sections = editorial?.sections.length ? editorial.sections : page.sections;
  const boost = guideStrengthening(page.slug);
  const faqs = shape?.faqs ?? (editorial?.sections.length ? editorial.sections.map((section) => ({ question: section.heading, answer: section.paragraphs[0] })) : page.faqs);
  // Every checklist guide links the money page; a strengthened guide also gets the
  // direct path to the $9 PDF and the $39 bundle.
  const linksMoneyPage = Boolean(boost) || page.product_id === 'checklist-pdf';
  const moneyHref = hrefFrom(host, strengthening.money_page.path);
  const bundle = productById(strengthening.product_path.bundle.product_id);
  // publisher by @id: lib/site-home.ts owns the one Organization node, the one with
  // the logo and the sameAs profiles, and app/layout.tsx emits it on every page.
  const article = { '@context': 'https://schema.org', '@type': 'Article', headline: guideStrengthening(page.slug)?.title ?? page.title, description: guideMetaDescription(page), mainEntityOfPage: canonical, ...dateModifiedFor(`/guides/${page.slug}`), publisher: { '@id': ORGANIZATION_ID }, ...editorialArticleFields(page.slug), ...budgetArticleFields(page.slug) };
  const faq = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) };
  return <article data-testid="guide-definition" className="mx-auto max-w-5xl space-y-10 md:space-y-14">
    <Breadcrumbs items={[{ name: 'Guides', href: '/guides', canonical: canonicalUrl(host, '/guides') }, { name: page.title, href: `/guides/${page.slug}`, canonical }]} />
    <header className="rounded-[2rem] bg-white p-7 shadow-soft md:p-12"><p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/45">{page.cluster}</p><h1 className="mt-4 font-serif text-5xl leading-tight md:text-7xl">{boost?.h1 ?? page.title}</h1><p className="definition mt-6 max-w-4xl text-xl leading-9 text-charcoal/70">{shape?.definition ?? editorial?.definition ?? guideLead(page)}</p><Link href={hrefFrom(host, page.hub_route ?? "/guides")} className="no-print mt-7 inline-flex rounded-2xl border border-charcoal/20 bg-linen px-5 py-3 font-bold">Start with the complete {page.cluster.toLowerCase()} hub →</Link></header>
    <section><h2 className="font-serif text-4xl">Quick answer</h2><p className="mt-4 leading-8">{guideRecommendation(page)}</p></section>
    {editorial?.fields.length ? <section><h2 className="font-serif text-4xl">What should the working record contain?</h2><ul className="mt-5 list-disc pl-6">{editorial.fields.map((field) => <li key={field} className="mt-2">{field}</li>)}</ul></section> : <section><h2 className="font-serif text-4xl">How should I work through this plan?</h2><ol className="list-decimal pl-6">{page.steps.filter((step) => !/Record the controlling|Test the plan against|Review the working version|Freeze and date/.test(step)).map((step) => <li key={step} className="mt-3">{step}</li>)}</ol></section>}
    {(sections ?? []).map((section) => <section key={section.heading} className="rounded-[1.75rem] bg-white p-7 md:p-9"><h2 className="font-serif text-4xl md:text-5xl">{questionHeading(section.heading)}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-4 text-base leading-7 text-charcoal/70">{paragraph}</p>)}{'bullets' in section && Array.isArray(section.bullets) && <ul className="mt-5 grid gap-3 md:grid-cols-2">{section.bullets.map((item) => <li key={item} className="rounded-2xl bg-ivory p-4">✓ {item}</li>)}</ul>}</section>)}
    {!editorial?.sections.length && <section className="grid gap-4 md:grid-cols-2">{page.examples.filter((example) => example.title !== 'Control check').map((example) => <article key={example.title}><h2 className="font-serif text-3xl">How would this work in practice?</h2><p>{example.body}</p></article>)}</section>}
    <ConsolidatedDecisions path={`/guides/${page.slug}`} />
    <section id={shape ? "budget-faq" : "guide-faq"}><p className="text-xs font-bold uppercase tracking-[.22em] text-charcoal/45">Questions couples ask</p><h2 className="mt-3 font-serif text-5xl">Frequently asked questions</h2><div className="mt-6 grid gap-4">{faqs.map((item) => <details key={item.question} className="rounded-[1.5rem] border border-charcoal/10 bg-white p-6"><summary className="cursor-pointer font-serif text-2xl">{item.question}</summary><p className="mt-3 leading-7 text-charcoal/70">{item.answer}</p></details>)}</div></section>
    <section className="no-print rounded-[1.75rem] border border-charcoal/10 bg-white p-7"><h2 className="font-serif text-4xl">Related guides</h2>{linksMoneyPage && !boost && <Link href={moneyHref} className="mt-4 inline-flex font-bold underline underline-offset-4" data-testid="guide-money-link">{strengthening.money_page.link_label} →</Link>}<div className="mt-5 grid gap-3 md:grid-cols-2">{related.map((item) => item && <Link key={item.slug} href={hrefFrom(host, `/guides/${item.slug}`)} className="rounded-2xl bg-ivory p-4 font-bold transition hover:bg-linen">{item.title} →</Link>)}</div></section>
    <aside data-testid="guide-planner-entry" className="rounded-2xl bg-white p-7"><h2 className="font-serif text-4xl">What is my next step?</h2>
      <Link href={hrefFrom(host, `${plannerHref(seedFromGuide(page))}&page_kind=guide&slug=${page.slug}`)} data-testid="guide-planner-link">{plannerLabelForGuide(page)}</Link>
      {product && <p><Link href={hrefFrom(host, `${product.route}?page_kind=guide&slug=${page.slug}`)} data-testid="guide-pdf-link">Review {product.name} — ${product.price}</Link></p>}
      {boost && <div data-testid="guide-product-path"><Link href={hrefFrom(host, strengthening.product_path.bundle.route)} data-testid="guide-bundle-link">All four tools — ${bundle?.price}</Link><p><Link href={moneyHref} data-testid="guide-money-link">{strengthening.money_page.link_label}</Link></p></div>}
    </aside>
    <footer className="text-sm leading-7">{page.verification_boundary}</footer>
    {shape ? <BudgetEvidence slug={page.slug} /> : <EditorialEvidence slug={page.slug} />}
    <JsonLd data={[article, faq]} />
  </article>;
}
