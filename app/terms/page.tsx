import { seoMetadata } from '@/lib/seo';
import { PARENT_HOST } from '@/lib/site-config';
import Link from 'next/link';
export const metadata = seoMetadata({
  title: 'Terms of Use',
  description: 'Terms for the Dream Wedding Builder product family. Purchases grant a limited, non-transferable personal-use license, and product outputs are aids you must verify.',
  host: PARENT_HOST,
  path: '/terms'
});
export default function Page(){return <article className="mx-auto max-w-3xl"><p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/50">Dream Wedding Builder product family</p><h1 className="mt-4 font-serif text-6xl">Terms of Use</h1><p className="mt-6 text-lg leading-8 text-charcoal/70">These terms govern the Dream Wedding Builder product family and its four paid products. Purchases grant a limited, non-transferable personal-use license. Files may not be resold, redistributed, sublicensed, or published as templates. Product outputs are organizational aids and must be verified against actual contracts, provider requirements, local rules, safety obligations, dietary information, accessibility needs, and professional advice.</p><p className="mt-6 leading-7 text-charcoal/70">These terms cover the four paid products and the complete suite. Each product page lists the exact files, the delivery method, and the price before checkout: <Link className="underline underline-offset-4" href="/shop">see every wedding planning tool</Link>.</p><p className="mt-6 text-sm">Support: <a className="underline" href="mailto:info@weddingchecklistpdf.com">info@weddingchecklistpdf.com</a></p></article>}