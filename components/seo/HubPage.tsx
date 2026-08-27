import Image from 'next/image';
import Link from 'next/link';
import { Breadcrumbs } from './Breadcrumbs';
import { JsonLd } from './JsonLd';
import { RelatedLinks } from './RelatedLinks';
import { canonicalUrl } from '@/lib/site-config';
import { hubRecommendation, type HubPage as HubPageData } from '@/lib/seo';
import { RecommendationSummary } from './RecommendationSummary';
import { productById } from '@/lib/products';
import { dateModifiedFor } from '@/lib/lastmod';
import { PrintButton } from '@/components/PrintButton';

type Preview = { src: string; title: string; caption: string; alt: string };

export function HubPage({ slug, page }: { slug: string; page: HubPageData }) {
  const canonical = canonicalUrl(page.host, `/${slug}`);
  const product = productById(page.product_id);
  const previews = product && 'gallery' in product && Array.isArray(product.gallery) ? product.gallery as Preview[] : [];
  const howTo = page.schema === 'HowTo' ? { '@context': 'https://schema.org', '@type': 'HowTo', name: page.title, description: page.description, step: page.sections.flatMap((section) => section.bullets ?? []).map((text, index) => ({ '@type': 'HowToStep', position: index + 1, text })) } : null;
  // dateModified was hardcoded, so every hub told crawlers it was last touched on
  // the same day regardless of what had actually changed. It now comes from the
  // ledger the sitemap uses, and is omitted rather than guessed when unknown.
  const article = { '@context': 'https://schema.org', '@type': 'Article', headline: page.title, description: page.description, mainEntityOfPage: canonical, publisher: { '@type': 'Organization', name: 'Dream Wedding Builder', url: 'https://weddingchecklistpdf.com/' }, ...dateModifiedFor(`/${slug}`) };
  const faq = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: page.faqs.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) };
  return <article className="mx-auto max-w-5xl space-y-10 md:space-y-14">
    <Breadcrumbs items={[{ name: 'Dream Wedding Builder', href: 'https://weddingchecklistpdf.com/', canonical: 'https://weddingchecklistpdf.com/' }, { name: page.h1, href: `/${slug}`, canonical }]} />
    <header className="rounded-[2rem] bg-white p-7 shadow-soft md:p-12"><p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/45">{page.eyebrow}</p><h1 className="mt-4 font-serif text-5xl leading-[1.02] md:text-7xl">{page.h1}</h1><p className="mt-6 max-w-4xl text-lg leading-8 text-charcoal/70">{page.intro}</p><div className="no-print mt-7 flex flex-wrap gap-3">{product && <Link href={`${product.route}#look-inside`} className="rounded-2xl bg-charcoal px-6 py-4 font-bold text-linen">Look inside {product.name} →</Link>}{page.printable && <PrintButton />}</div></header>
    <RecommendationSummary statement={hubRecommendation(page)} product={product ?? null} productHref={product?.route} />
    <nav aria-label="On this page" className="no-print rounded-[1.5rem] border border-charcoal/10 bg-linen p-6"><p className="text-xs font-bold uppercase tracking-[.22em] text-charcoal/45">On this page</p><ol className="mt-3 grid gap-2 md:grid-cols-2">{page.sections.map((section, index) => <li key={section.heading}><a className="font-semibold underline decoration-charcoal/20 underline-offset-4" href={`#section-${index + 1}`}>{section.heading}</a></li>)}</ol></nav>
    {page.sections.map((section, index) => <section id={`section-${index + 1}`} key={section.heading} className="scroll-mt-28 rounded-[1.75rem] bg-white p-7 md:p-9"><h2 className="font-serif text-4xl md:text-5xl">{section.heading}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-4 text-base leading-7 text-charcoal/70">{paragraph}</p>)}{section.bullets && <ul className="mt-5 grid gap-3 md:grid-cols-2">{section.bullets.map((item) => <li key={item} className="rounded-2xl bg-ivory p-4">✓ {item}</li>)}</ul>}</section>)}
    <section className="overflow-x-auto rounded-[1.75rem] bg-white p-7 md:p-9"><h2 className="font-serif text-4xl">Working view</h2><table className="mt-6 min-w-full border-collapse text-left text-sm"><thead><tr>{page.table.headers.map((header) => <th key={header} className="border-b border-charcoal/20 bg-linen p-3">{header}</th>)}</tr></thead><tbody>{page.table.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className="border-b border-charcoal/10 p-3 align-top">{cell || ' '}</td>)}</tr>)}</tbody></table></section>
    {product && previews.length > 0 && <section className="no-print rounded-[2rem] bg-charcoal p-7 text-linen md:p-10"><p className="text-xs font-bold uppercase tracking-[.22em] text-linen/55">Look inside the paid files</p><div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><h2 className="font-serif text-5xl">Real previews from {product.name}</h2><p className="mt-4 max-w-3xl text-linen/75">These are flattened, watermarked images generated from the canonical paid PDF and XLSX release. They show the real structure without exposing an editable template.</p></div><Link href={`${product.route}#look-inside`} className="inline-flex shrink-0 rounded-2xl bg-linen px-6 py-4 font-bold text-charcoal">See every preview — ${product.price}</Link></div><div className="mt-7 grid gap-4 md:grid-cols-3">{previews.slice(0,3).map(preview=><figure key={preview.src} className="overflow-hidden rounded-2xl bg-white text-charcoal"><div className="relative aspect-[40/27]"><Image src={preview.src} alt={preview.alt} fill sizes="(max-width:768px) 100vw, 33vw" className="object-contain"/></div><figcaption className="p-4"><strong>{preview.title}</strong><p className="mt-2 text-xs leading-5 text-charcoal/60">{preview.caption}</p></figcaption></figure>)}</div></section>}
    <section><p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/45">Questions couples ask</p><h2 className="mt-3 font-serif text-5xl">Frequently asked questions</h2><div className="mt-6 grid gap-4">{page.faqs.map((item) => <details key={item.question} className="rounded-[1.5rem] border border-charcoal/10 bg-white p-6"><summary className="cursor-pointer font-serif text-2xl">{item.question}</summary><p className="mt-3 leading-7 text-charcoal/70">{item.answer}</p></details>)}</div></section>
    {product && <section className="no-print rounded-[2rem] border border-charcoal/10 bg-white p-7 md:p-10"><p className="text-xs font-bold uppercase tracking-[.22em] text-charcoal/45">Continue with the working system</p><h2 className="mt-3 font-serif text-5xl">{product.name}</h2><p className="mt-4 max-w-3xl text-charcoal/70">This educational guide explains the method. The product page shows the actual paid-file previews, exact file inventory, and checkout path.</p><Link href={product.route} className="mt-6 inline-flex rounded-2xl bg-charcoal px-6 py-4 font-bold text-linen">Review {product.name} — ${product.price}</Link></section>}
    <RelatedLinks links={page.related} />
    <footer className="rounded-[1.5rem] border border-charcoal/10 bg-white p-6 text-sm leading-6 text-charcoal/60">Educational planning guidance only. Verify venue rules, contracts, prices, timing, capacities, accessibility and dietary information, legal requirements, and vendor instructions with the appropriate source.</footer>
    <JsonLd data={[article, faq, ...(howTo ? [howTo] : [])]} />
  </article>;
}
