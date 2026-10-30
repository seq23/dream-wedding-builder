import Link from 'next/link';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { seoMetadata } from '@/lib/seo';
import { apexHost, canonicalUrl, hrefFrom, isCanonicalHost, PARENT_HOST, productForHost, type SiteHost } from '@/lib/site-config';
import { homePathFor, ORGANIZATION, siteHome, siteOrganizationId } from '@/lib/site-home';
import { JsonLd } from '@/components/seo/JsonLd';
import { Breadcrumbs } from '@/components/seo/Breadcrumbs';
import { supportEmail } from '@/lib/products';

// Why this page exists: the authority audit of 30 Oct 2026 found no editorial
// policy on any of the four hosts. An engine deciding whether to cite a page weighs
// how its publisher says the page was made, and "how we built these templates" was
// stated nowhere. It renders on every host (route_ownership.json shared_host_routes)
// and describes that host's own product, so each site answers for itself rather
// than redirecting to a sibling. Everything here is checkable from the site: the
// build rule a guide must pass, where the previews come from, what the figures are
// not, and the corrections address. Nothing claims a credential, a reviewer, an
// endorsement or a person.

const PATH = '/editorial-policy';

async function resolvedHost(): Promise<SiteHost> {
  const h = await headers();
  const host = apexHost(h.get('x-forwarded-host') ?? h.get('host'));
  return (isCanonicalHost(host) ? host : PARENT_HOST) as SiteHost;
}

function copyFor(host: SiteHost) {
  const site = siteHome(host);
  return {
    title: `Editorial policy: how ${site.name} is built`,
    description: `How ${site.name} writes its wedding planning guides, builds its paid template, checks its figures, labels affiliate links and corrects mistakes.`
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const host = await resolvedHost();
  const { title, description } = copyFor(host);
  return seoMetadata({ title, description, host, path: PATH });
}

export default async function EditorialPolicy() {
  const host = await resolvedHost();
  const site = siteHome(host);
  const product = productForHost(host);
  const { title, description } = copyFor(host);
  const canonical = canonicalUrl(host, PATH);
  const page = {
    '@context': 'https://schema.org', '@type': 'WebPage', '@id': `${canonical}#webpage`,
    url: canonical, name: title, description,
    about: { '@id': siteOrganizationId(host) }, publisher: { '@id': siteOrganizationId(host) }
  };
  return <article className="mx-auto max-w-4xl space-y-10 md:space-y-14">
    <Breadcrumbs items={[{ name: site.name, href: homePathFor(host), canonical: canonicalUrl(host, homePathFor(host)) }, { name: 'Editorial policy', href: PATH, canonical }]} />

    <header className="rounded-[2rem] bg-white p-7 shadow-soft md:p-12">
      <p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/45">Editorial policy</p>
      <h1 className="mt-4 font-serif text-5xl leading-tight md:text-6xl">How {site.name} is built</h1>
      <p className="mt-6 max-w-3xl text-xl leading-9 text-charcoal/70">{site.name} is one of four single-purpose sites published by {ORGANIZATION.name}. This page explains how its guides are written, how its paid template is built, what its numbers are, and how mistakes get corrected.</p>
    </header>

    <section className="rounded-[1.75rem] bg-white p-7 md:p-9">
      <h2 className="font-serif text-4xl">How a guide is written</h2>
      <p className="mt-4 leading-7 text-charcoal/70">Every guide on this site is built around one planning decision and must carry five things: the direct answer, the working method, a worked example, the mistake couples most often make, and the point where you have to check something yourself. A guide missing any of the five does not publish. That rule is enforced by this site&rsquo;s own build, not by memory.</p>
      <p className="mt-4 leading-7 text-charcoal/70">Guides are written by the publisher, not by named individual writers. Nothing here is presented as the personal experience of a wedding planner, and no page claims a reviewer, a credential or an endorsement it does not have.</p>
    </section>

    {product ? <section className="rounded-[1.75rem] bg-linen p-7 md:p-9">
      <h2 className="font-serif text-4xl">How the {product.name} is built</h2>
      <p className="mt-4 leading-7 text-charcoal/70">{product.promise}</p>
      <p className="mt-4 leading-7 text-charcoal/70">It is a one-time ${product.price} purchase. Every preview image on its page is generated from the file you would actually receive, watermarked, so what you see is what you get. The full file list is on the <Link href={hrefFrom(host, product.route)} className="font-bold underline underline-offset-4">{product.name} page</Link>.</p>
    </section> : null}

    <section className="rounded-[1.75rem] bg-white p-7 md:p-9">
      <h2 className="font-serif text-4xl">What the numbers are, and are not</h2>
      <p className="mt-4 leading-7 text-charcoal/70">Costs, timings, table sizes and lead times here are planning benchmarks: figures to plan with before you have quotes, and to replace with real quotes as soon as you have them. They are not quotes or prices anyone has agreed to hold. Venue rules, contracts, capacities, accessibility, dietary needs and legal requirements vary by place and supplier, and the guides say so where it matters.</p>
    </section>

    <section className="rounded-[1.75rem] bg-white p-7 md:p-9">
      <h2 className="font-serif text-4xl">Independence and affiliate links</h2>
      <p className="mt-4 leading-7 text-charcoal/70">No venue or supplier pays to appear on this site, and there are no paid listings. Where a page carries affiliate links, the page says so next to them: if you buy through one, we may earn a commission at no cost to you.</p>
    </section>

    <section className="rounded-[1.75rem] border border-charcoal/15 bg-white p-7 md:p-9">
      <h2 className="font-serif text-4xl">Corrections</h2>
      <p className="mt-4 leading-7 text-charcoal/70">If a figure is wrong, or a file does not contain what its page says it contains, write to <a href={`mailto:${supportEmail}`} className="font-bold underline underline-offset-4">{supportEmail}</a>. It gets fixed at the source, so every page that uses it is corrected at once. More about the publisher is on the <a href={canonicalUrl(PARENT_HOST, '/about')} className="font-bold underline underline-offset-4">About page</a>.</p>
    </section>
    <JsonLd data={page} />
  </article>;
}
