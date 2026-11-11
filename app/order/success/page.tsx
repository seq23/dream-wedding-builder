import Link from 'next/link';
import { OrderStatus } from '@/components/OrderStatus';

export default async function Success({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  return <article className="mx-auto max-w-3xl rounded-[12px] bg-linen p-6 md:p-10">
    <p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/50">Payment received</p>
    <h1 className="mt-4 font-serif text-5xl md:text-6xl">Thank you. Let’s get your files into your hands.</h1>
    <p className="mt-5 max-w-2xl text-lg leading-8 text-charcoal/70">Your purchase is ready below. We also emailed it to the address you paid with, so you can open it later or on another phone or computer.</p>
    <p className="mt-3 max-w-2xl leading-7 text-charcoal/70">No email in a few minutes? Look in spam, then <Link href="/order/link" className="font-bold text-blue underline underline-offset-4">get your link again</Link> with the email you bought with.</p>
    {session_id ? <OrderStatus sessionId={session_id}/> : <p className="mt-7 rounded-2xl bg-white p-5">We could not find your order from this page. Your purchase is safe: <Link href="/order/link" className="font-bold text-blue underline underline-offset-4">get your link again</Link> with the email you bought with.</p>}
    <div className="mt-7 flex flex-wrap gap-3"><Link href="/shop" className="rounded-full border border-charcoal/20 bg-white px-5 py-3 font-bold">View all wedding tools and prices</Link><a className="rounded-full bg-charcoal px-5 py-3 font-bold text-linen" href="mailto:info@weddingchecklistpdf.com">Email us about your order</a></div>
  </article>;
}
