import Link from 'next/link';
import type { Metadata } from 'next';
import { products, suite } from '@/lib/products';
import { CheckoutButton } from '@/components/CheckoutButton';

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
    'The four Dream Wedding Builder tools side by side: what each one is best for, its one-time price, and how the complete suite compares with buying separately.'
};

export default function Compare(){return <div className="space-y-10"><section><p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/45">Side-by-side decision guide</p><h1 className="mt-3 font-serif text-6xl">Which wedding tool solves your next problem?</h1><p className="mt-4 text-lg text-charcoal/65">Every product is a one-time purchase. The complete suite costs ${suite.price}, compared with ${suite.standalone_value} separately.</p><p className="mt-3 text-sm text-charcoal/60">Prefer the full product pages? <Link className="font-bold underline underline-offset-4" href="/shop">Browse every wedding planning tool</Link>.</p></section><div className="overflow-x-auto rounded-[2rem] border border-charcoal/10 bg-white"><table className="min-w-full text-left"><thead className="bg-linen"><tr><th className="p-5">Product</th><th className="p-5">Best for</th><th className="p-5">Price</th><th className="p-5">Action</th></tr></thead><tbody>{products.map(p=><tr className="border-t border-charcoal/10" key={p.id}><td className="p-5"><Link className="font-bold underline" href={p.route}>{p.name}</Link></td><td className="p-5 text-sm text-charcoal/65">{p.promise}</td><td className="p-5 font-serif text-3xl">${p.price}</td><td className="p-5"><CheckoutButton sku={p.sku} price={p.price} label={`Buy ${p.name} — $${p.price}`} productName={p.name}/></td></tr>)}</tbody></table></div><section className="rounded-[2rem] bg-charcoal p-8 text-linen"><h2 className="font-serif text-5xl">Get all four for ${suite.price}</h2><p className="mt-3 text-linen/70">Save ${suite.savings} compared with buying every product separately.</p><div className="mt-6"><CheckoutButton sku={suite.sku} price={suite.price} label={`Get All Four Wedding Tools — $${suite.price}`} productName={suite.name}/></div><p className="mt-5 text-sm text-linen/65">Full details for each product: <Link className="font-bold underline underline-offset-4" href="/products/operations-suite">Dream Wedding Operations Suite</Link>.</p></section></div>}
