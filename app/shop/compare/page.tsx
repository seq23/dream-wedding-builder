import Link from 'next/link';
import type { Metadata } from 'next';
import { products, suite } from '@/lib/products';
import { CheckoutButton } from '@/components/CheckoutButton';
import { PARENT_HOST, hrefFrom } from '@/lib/site-config';

// app/shop/compare/layout.tsx already declares robots noindex,nofollow,noarchive,
// matching indexable:false in data/seo/route_ownership.json, so this page is
// deliberately outside search. What it was missing is a name: with no title and
// no description it inherited the layout default and rendered a browser tab
// reading only "Dream Wedding Builder". Title and description are set here and
// the robots directive is deliberately left to the layout, so this page keeps the
// same posture as /admin, /order, /pack and /dashboard.
export const metadata: Metadata = {
  title: 'Compare Wedding Planning Tools',
  description:
    'The four Dream Wedding tools side by side: what each one is best for, its one-time price, and how the Dream Wedding Operations Suite compares with buying separately.'
};

export default function Compare(){return <div className="space-y-10"><section><p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/45">Side-by-side decision guide</p><h1 className="mt-3 font-serif text-6xl">Which wedding tool solves your next problem?</h1><p className="mt-4 text-lg text-charcoal/65">Every product is a one-time purchase. The {suite.name} (all four) costs ${suite.price}, compared with ${suite.standalone_value} separately.</p><p className="mt-3 text-sm text-charcoal/60">Prefer the full product pages? <Link className="font-bold underline underline-offset-4" href="/shop">Browse every wedding planning tool</Link>.</p></section><div data-testid="compare-list" className="grid gap-4 md:grid-cols-2">{products.map(p=><article key={p.id} className="flex flex-col rounded-[12px] border border-charcoal/10 bg-white p-5"><h2 className="font-serif text-3xl leading-tight"><Link className="underline underline-offset-4" href={hrefFrom(PARENT_HOST, p.route)}>{p.name}</Link></h2><p className="mt-2 font-serif text-4xl">${p.price}</p><p className="mt-3 flex-1 text-sm leading-6 text-charcoal/65"><strong className="text-charcoal">Best for: </strong>{p.promise}</p><div className="mt-5"><CheckoutButton sku={p.sku} price={p.price} label={`Get the ${p.name} — $${p.price}`} productName={p.name}/></div></article>)}</div><section className="rounded-[12px] bg-charcoal p-8 text-linen"><h2 className="font-serif text-5xl">Get all four for ${suite.price}</h2><p className="mt-3 text-linen/70">Save ${suite.savings} compared with buying every product separately.</p><div className="mt-6"><CheckoutButton sku={suite.sku} price={suite.price} label={`Get the ${suite.name} — $${suite.price}`} productName={suite.name}/></div><p className="mt-5 text-sm text-linen/65">Full details for each product: <Link className="font-bold underline underline-offset-4" href="/products/operations-suite">Dream Wedding Operations Suite</Link>.</p></section></div>}
