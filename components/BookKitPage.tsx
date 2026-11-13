import Image from 'next/image';
import Link from 'next/link';
import type { BookKit } from '@/lib/book-kits';
import { CheckoutButton } from '@/components/CheckoutButton';
import { hrefFrom } from '@/lib/site-config';

// The product page of a Kindle-book kit. The route renders it only while the kit is on sale
// (app/products/[slug]/page.tsx); an off-sale kit is unlisted and answers 404.
export function BookKitPage({ kit }: { kit: BookKit }) {
  const buy = () => <CheckoutButton sku={kit.sku} price={kit.price} label={`Get ${kit.short} — $${kit.price}`} />;
  return <div className="space-y-14 pb-24">
    <section className="rounded-[12px] border border-charcoal/10 bg-white p-6 shadow-soft md:p-10">
      <p className="text-xs font-bold uppercase tracking-[.28em] text-charcoal/50">A Dream Wedding printable kit</p>
      <h1 className="mt-4 font-serif text-5xl leading-[1.02] md:text-6xl">{kit.name}</h1>
      <p className="mt-3 font-serif text-2xl italic">{kit.headline}</p>
      <p className="definition mt-5 max-w-2xl text-lg leading-8 text-charcoal/75">{kit.promise}</p>
      <div className="mt-6 flex flex-wrap items-center gap-4"><p className="font-serif text-5xl">${kit.price}</p><p className="text-sm text-charcoal/60">One-time purchase · {kit.pages}-page printable PDF</p></div>
      <div className="mt-6 max-w-md">{buy()}</div>
      <p className="mt-4 text-sm text-charcoal/60">Made for readers of the Kindle book. <Link className="underline" href={hrefFrom(kit.domain, `/amazon/${kit.book_slug}`)}>Book companion page</Link>.</p>
    </section>
    <section><h2 className="font-serif text-4xl">What is inside</h2><ul className="mt-5 grid gap-3 md:grid-cols-2">{kit.includes.map((item) => <li key={item} className="rounded-2xl bg-white p-4">✓ {item}</li>)}</ul><p className="mt-5 max-w-3xl text-charcoal/70">{kit.limits}</p></section>
    <section id="look-inside"><h2 className="font-serif text-4xl">Look inside</h2><div className="mt-6 grid gap-6 lg:grid-cols-3">{kit.gallery.map((preview) => <figure key={preview.src} className="overflow-hidden rounded-[12px] border border-charcoal/10 bg-white"><div className="relative aspect-[40/27] bg-ivory"><Image src={preview.src} alt={preview.alt} fill sizes="(max-width:1024px) 100vw, 33vw" className="object-contain" /></div><figcaption className="p-5"><h3 className="font-serif text-2xl">{preview.title}</h3><p className="mt-2 text-sm leading-6 text-charcoal/65">{preview.caption}</p></figcaption></figure>)}</div></section>
    <section className="rounded-[12px] border border-charcoal/10 bg-white p-6 md:p-10"><h2 className="font-serif text-4xl">Get the kit</h2><div className="mt-5 max-w-md">{buy()}</div><p className="mt-4 text-sm text-charcoal/60">An organizing aid, not legal or professional planning advice. Personal-use license.</p></section>
  </div>;
}
