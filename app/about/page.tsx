import Link from 'next/link';
import type { Metadata } from 'next';
import { seoMetadata } from '@/lib/seo';
import { canonicalUrl, CANONICAL_HOSTS, hrefFrom, PARENT_HOST, productForHost } from '@/lib/site-config';
import { ORGANIZATION, ORGANIZATION_ID } from '@/lib/site-home';
import { JsonLd } from '@/components/seo/JsonLd';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { products, suite, supportEmail } from '@/lib/products';

// Why this page exists: the Search Readiness audit (item c6, 2026-10-25) found no
// /about on any of the four hosts. An engine deciding whether to cite a page weighs
// who is publishing it, and a publisher with no About page is the last thing it
// quotes - the Organization node asserted a name and a logo that nothing on the site
// explained. Everything here is checkable from the site itself: the four domains,
// the catalog and its prices, how the guides are produced, and what the figures are
// not. Nothing claims a credential, an endorsement or a person.

const CANONICAL = canonicalUrl(PARENT_HOST, '/about');
const TITLE = 'About Dream Wedding Builder';
const DESCRIPTION = 'Who publishes Dream Wedding Builder, how its wedding planning guides and paid files are produced and checked, and what its figures are and are not.';

export const metadata: Metadata = seoMetadata({ title: TITLE, description: DESCRIPTION, host: PARENT_HOST, path: '/about' });

export default function About() {
  const aboutPage = {
    '@context': 'https://schema.org', '@type': 'AboutPage', '@id': `${CANONICAL}#aboutpage`,
    url: CANONICAL, name: TITLE, description: DESCRIPTION,
    mainEntity: { '@id': ORGANIZATION_ID }
  };
  const catalog = [...products, suite];
  return <article className="mx-auto max-w-4xl space-y-10 md:space-y-14">
    <Breadcrumbs items={[{ name: ORGANIZATION.name, href: '/', canonical: canonicalUrl(PARENT_HOST, '/') }, { name: 'About', href: '/about', canonical: CANONICAL }]} />

    <header className="rounded-[2rem] bg-white p-7 shadow-soft md:p-12">
      <p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/45">The publisher</p>
      <h1 className="mt-4 font-serif text-5xl leading-tight md:text-7xl">About Dream Wedding Builder</h1>
      <p className="mt-6 max-w-3xl text-xl leading-9 text-charcoal/70">Dream Wedding Builder publishes wedding planning guides and sells {products.length} editable planning files. It is an independent digital publisher: it takes no vendor commissions for placement, it does not broker introductions to venues or suppliers, and nothing on these sites is a paid listing.</p>
    </header>

    <section className="rounded-[1.75rem] bg-linen p-7 md:p-9">
      <h2 className="font-serif text-4xl">What we publish, and where</h2>
      <p className="mt-4 leading-7 text-charcoal/70">The same publisher runs {CANONICAL_HOSTS.length} sites, one per planning problem, so a reader looking for a seating chart is not made to read about budgets. Each site carries the guides for its own subject and one paid file that does the work those guides describe.</p>
      <ul className="mt-5 grid gap-3">
        {CANONICAL_HOSTS.map((host) => {
          const product = productForHost(host);
          return <li key={host} className="rounded-2xl bg-white p-4 leading-7">
            <a href={canonicalUrl(host, '/')} className="font-bold underline decoration-charcoal/20 underline-offset-4">{host}</a>
            {product ? <> — {product.name}, ${product.price}</> : null}
          </li>;
        })}
      </ul>
    </section>

    <section className="rounded-[1.75rem] bg-white p-7 md:p-9">
      <h2 className="font-serif text-4xl">How a guide is produced</h2>
      <p className="mt-4 leading-7 text-charcoal/70">Every guide is built around one planning decision and is required to carry the same five things: the direct answer, the working method, a worked example, the failure pattern couples hit, and the boundary at which the reader has to go and verify something themselves. A page that cannot state all five does not publish — that rule is enforced by this site&rsquo;s own build, not by an editor&rsquo;s memory.</p>
      <p className="mt-4 leading-7 text-charcoal/70">The guides are produced by this publisher rather than by named individual writers, and nothing here is presented as the personal experience of a wedding planner we have not hired. What is offered instead is the method, stated plainly enough to check, and the arithmetic shown rather than asserted.</p>
    </section>

    <section className="rounded-[1.75rem] bg-white p-7 md:p-9">
      <h2 className="font-serif text-4xl">What the numbers are, and are not</h2>
      <p className="mt-4 leading-7 text-charcoal/70">Costs, timings, table capacities and lead times on these sites are planning benchmarks: figures to plan against before you have quotes, and to replace with real quotes as soon as you have them. They are not quotes, estimates for your wedding, or prices anyone has agreed to hold. Venue rules, contracts, capacities, accessibility and dietary information, and legal requirements vary by place and by supplier, and every page says so where it matters.</p>
      <p className="mt-4 leading-7 text-charcoal/70">The <Link href={hrefFrom(PARENT_HOST, '/methodology')} className="font-bold underline underline-offset-4">constraint-first method</Link> these guides follow, and the <Link href={hrefFrom(PARENT_HOST, '/readiness-score')} className="font-bold underline underline-offset-4">readiness score</Link> the free planner reports, are both documented in full, including what they refuse to decide for you.</p>
    </section>

    <section className="rounded-[1.75rem] bg-white p-7 md:p-9">
      <h2 className="font-serif text-4xl">What we sell</h2>
      <p className="mt-4 leading-7 text-charcoal/70">{catalog.length} one-time purchases, no subscription, no account. Each product page shows watermarked previews generated from the file you would actually receive, states the full file inventory, and is delivered by protected download immediately after payment.</p>
      <ul className="mt-5 grid gap-2 text-sm leading-7">
        {catalog.map((item) => <li key={item.id}><Link href={hrefFrom(PARENT_HOST, item.route)} className="font-bold underline decoration-charcoal/20 underline-offset-4">{item.name}</Link> — ${item.price}</li>)}
      </ul>
      <p className="mt-5 leading-7 text-charcoal/70">The <Link href={hrefFrom(PARENT_HOST, '/refund-policy')} className="font-bold underline underline-offset-4">refund policy</Link> is published in full, and the free planner is genuinely free: it runs in your browser and your plan stays there.</p>
    </section>

    <section className="rounded-[1.75rem] border border-charcoal/15 bg-white p-7 md:p-9">
      <h2 className="font-serif text-4xl">Corrections and contact</h2>
      <p className="mt-4 leading-7 text-charcoal/70">If a figure on any of these sites is wrong, or a file does not contain what its page says it contains, write to <a href={`mailto:${supportEmail}`} className="font-bold underline underline-offset-4">{supportEmail}</a> and it gets corrected at the source rather than patched on one page. Purchase support uses the same address.</p>
    </section>

    <footer className="rounded-[1.5rem] border border-charcoal/10 bg-white p-6 text-sm leading-6 text-charcoal/60">Educational planning guidance only. Verify venue rules, contracts, prices, timing, capacities, accessibility and dietary information, legal requirements, and vendor instructions with the appropriate source.</footer>
    <JsonLd data={aboutPage} />
  </article>;
}
