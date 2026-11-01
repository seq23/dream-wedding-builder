import Link from 'next/link';
import type { Metadata } from 'next';
import { seoMetadata } from '@/lib/seo';
import { canonicalUrl, PARENT_HOST } from '@/lib/site-config';
import { ORGANIZATION } from '@/lib/site-home';
import { JsonLd } from '@/components/seo/JsonLd';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { SampleSignup } from '@/components/SampleSignup';
import searchLoopConfig from '@/search-loop.config.json';
import searchLoopLedger from '@/data/search-loop/pages.json';
import { searchLoopPages } from '@/lib/search-loop-pages.mjs';

// The hub for the pages the shared search engine (seq23/search-loop) publishes
// under /questions/ (owner ruling 1 Nov 2026: new pages publish straight away).
// Each engine page is a static file under public/questions/; this page is what
// links every one of them from the site, so no engine page is an orphan. It reads
// the engine's own ledger, so a page the engine merges leaves this list too.

const CANONICAL = canonicalUrl(PARENT_HOST, '/questions');
const TITLE = 'Wedding Planning Questions, Answered';
const DESCRIPTION = 'Short, sourced answers to the wedding planning questions couples search for: checklists, budgets, timelines, guest lists and seating, each with next steps.';

export const metadata: Metadata = seoMetadata({ title: TITLE, description: DESCRIPTION, host: PARENT_HOST, path: '/questions' });

export default function Questions() {
  const pages = searchLoopPages(searchLoopConfig, searchLoopLedger);
  const collection = {
    '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': `${CANONICAL}#collection`,
    url: CANONICAL, name: TITLE, description: DESCRIPTION,
    hasPart: pages.map((page) => ({ '@type': 'WebPage', url: canonicalUrl(PARENT_HOST, page.route), name: page.query }))
  };
  return <div className="mx-auto max-w-4xl space-y-10">
    <JsonLd data={collection} />
    <Breadcrumbs items={[{ name: ORGANIZATION.name, href: '/', canonical: canonicalUrl(PARENT_HOST, '/') }, { name: 'Planning questions', href: '/questions', canonical: CANONICAL }]} />
    <header className="rounded-[2rem] bg-white p-7 shadow-soft md:p-12">
      <p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/45">Wedding planning questions</p>
      <h1 className="mt-4 font-serif text-5xl md:text-6xl">{TITLE}</h1>
      <p className="mt-5 text-lg leading-8 text-charcoal/70">Each answer starts with the short version, then the steps, the sources it rests on and the questions couples ask next. New answers are added as couples search for them.</p>
    </header>
    {pages.length > 0
      ? <ul className="grid gap-3 md:grid-cols-2">{pages.map((page) => <li key={page.route}><a href={page.route} className="block rounded-[1.25rem] border border-charcoal/10 bg-white p-5 font-bold first-letter:uppercase">{page.query} →</a></li>)}</ul>
      : <p className="rounded-[1.25rem] border border-charcoal/10 bg-white p-5 text-charcoal/70">The first answers are being written. Until then, the <Link href="/guides" className="underline underline-offset-4">planning guides</Link> cover the same ground in depth.</p>}
    <SampleSignup/>
    <section className="rounded-[1.75rem] bg-charcoal p-7 text-linen md:p-10">
      <h2 className="font-serif text-4xl">Plan it from one checklist</h2>
      <p className="mt-4 max-w-3xl text-linen/75">The Wedding Checklist PDF puts every task, from the engagement to the day after, in order with the timing it needs.</p>
      <a className="mt-6 inline-flex rounded-2xl bg-linen px-6 py-4 font-bold text-charcoal" href={searchLoopConfig.action.url}>{searchLoopConfig.action.label}</a>
    </section>
  </div>;
}
