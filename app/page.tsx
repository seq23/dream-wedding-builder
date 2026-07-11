import Image from 'next/image';
import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import { CheckoutButton } from '@/components/CheckoutButton';
import { products, suite, supportEmail } from '@/lib/products';

const trust = [
  ['Instant protected delivery','Verified purchases receive secure access on the success page and by email.'],
  ['Real working files','Every product includes editable, printable, vendor-ready files—not a decorative one-page PDF.'],
  ['One-time purchase','Pay once. Keep the current release for personal use. No subscription.'],
  ['Human support',`Order and access help goes to ${supportEmail}.`]
];

export default function HomePage(){return <div className="space-y-16 md:space-y-24">
  <section className="overflow-hidden rounded-[2rem] border border-charcoal/10 bg-white shadow-[0_30px_90px_rgba(78,62,49,.12)]">
    <div className="grid lg:grid-cols-[.82fr_1.18fr]">
      <div className="flex flex-col justify-center p-6 md:p-10 lg:p-12 xl:p-16">
        <p className="inline-flex w-fit rounded-full bg-rose/20 px-4 py-2 text-[11px] font-bold uppercase tracking-[.2em] text-charcoal/70">The complete wedding planning system</p>
        <h1 className="mt-5 font-serif text-5xl leading-[.98] sm:text-6xl lg:text-7xl">Plan every detail.<br/>Stay on budget.<br/><em className="font-normal text-[#a88032]">Enjoy the day.</em></h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-charcoal/70 md:text-lg md:leading-8">Use Dream Wedding Builder free. Then buy the exact execution tool you need for seating, budget, timeline, or your planning checklist.</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2"><Link className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-charcoal px-6 py-4 text-center font-bold text-linen shadow-lg transition hover:-translate-y-0.5" href="/build">Build my wedding free →</Link><Link className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-charcoal/20 bg-white px-6 py-4 text-center font-bold transition hover:bg-linen" href="/shop">Shop all wedding tools — $39</Link></div>
        <p className="mt-3 text-sm text-charcoal/55">Save $13 with the complete suite. One-time purchase.</p>
        <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-3 text-sm font-semibold text-charcoal/65"><span>✓ One-time payment</span><span>✓ Instant access</span><span>✓ Editable files</span><span>✓ Use forever</span></div>
      </div>
      <div className="relative min-h-[420px] bg-linen sm:min-h-[520px] lg:min-h-[650px]"><Image src="/product-images/merch/operations-suite-hero.webp" alt="Dream Wedding Operations Suite with the Wedding Seating Chart Maker, Wedding Budget Spreadsheet, Wedding Timeline Template, and Wedding Checklist PDF" fill priority sizes="(max-width:1024px) 100vw, 58vw" className="object-cover"/></div>
    </div>
  </section>

  <section>
    <div className="mx-auto max-w-4xl text-center"><p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/45">Choose the wedding tool you need most</p><h2 className="mt-3 font-serif text-4xl leading-tight md:text-6xl">Four high-stress wedding jobs. Four finished solutions.</h2><p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-charcoal/65 md:text-lg">Every product card shows the full product name and price before you click. Every product page explains the files, outcome, delivery process, and limitations before checkout.</p></div>
    <div className="mt-9 grid gap-6 md:grid-cols-2 xl:grid-cols-4">{products.map(p=><ProductCard key={p.id} product={p}/>)}</div>
  </section>

  <section className="overflow-hidden rounded-[2rem] bg-charcoal text-linen shadow-[0_30px_80px_rgba(39,35,31,.2)]"><div className="grid lg:grid-cols-[.9fr_1.1fr]"><div className="p-7 md:p-10 lg:p-12"><p className="inline-flex rounded-full bg-[#c79425] px-4 py-2 text-xs font-bold uppercase tracking-[.18em] text-white">Best value — save $13</p><h2 className="mt-5 font-serif text-5xl md:text-6xl">All four wedding tools for $39</h2><p className="mt-4 text-lg leading-8 text-linen/75">${suite.standalone_value} if purchased separately. Keep every editable file in one connected planning system.</p><ul className="mt-6 grid gap-3 sm:grid-cols-2">{suite.features.map(f=><li className="text-sm font-semibold text-linen/90" key={f}>✓ {f}</li>)}</ul><div className="mt-8 max-w-md"><CheckoutButton sku={suite.sku} price={suite.price} label="Get All Four Wedding Tools — $39" productName={suite.name}/></div><p className="mt-3 text-sm text-linen/55">One-time payment • Instant protected access • No subscription</p></div><div className="relative min-h-[420px] lg:min-h-full"><Image src="/product-images/operations-suite.webp" alt="All four Dream Wedding planning tools included in the $39 Operations Suite" fill sizes="(max-width:1024px) 100vw, 55vw" className="object-cover"/></div></div></section>

  <section className="grid gap-8 lg:grid-cols-[1.35fr_.65fr]">
    <div><p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/45">Why couples pay for these tools</p><h2 className="mt-3 font-serif text-4xl md:text-6xl">Free inspiration is easy. Final-mile execution is not.</h2><p className="mt-4 max-w-3xl text-lg leading-8 text-charcoal/65">These products are built around the handoffs and mistakes that create expensive wedding-week stress: unassigned guests, hidden balances, missing owners, impossible timing, and generic task lists.</p><div className="mt-8 grid gap-4 sm:grid-cols-2">{trust.map(([h,b])=><article className="rounded-[1.5rem] border border-charcoal/8 bg-white p-6 shadow-soft" key={h}><h3 className="font-serif text-2xl">{h}</h3><p className="mt-3 text-sm leading-6 text-charcoal/65">{b}</p></article>)}</div></div>
    <aside className="rounded-[2rem] bg-linen p-7 md:p-9"><p className="text-xs font-bold uppercase tracking-[.22em] text-charcoal/45">How it works</p><h2 className="mt-3 font-serif text-4xl">From purchase to usable handoff in four steps.</h2><ol className="mt-7 space-y-5 text-charcoal/70">{[['1','Choose your tool','Buy one clearly priced product or the complete suite.'],['2','Pay securely','Stripe handles checkout and payment verification.'],['3','Receive access','Verified purchases unlock protected files on screen and by email.'],['4','Customize and hand off','Use the editable files with your partner, venue, vendors, or coordinator.']].map(([n,h,b])=><li key={n} className="grid grid-cols-[2rem_1fr] gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-charcoal text-sm font-bold text-linen">{n}</span><div><strong className="block text-charcoal">{h}</strong><span className="text-sm leading-6">{b}</span></div></li>)}</ol></aside>
  </section>

  <section className="rounded-[2rem] bg-rose/20 p-7 text-center md:p-12"><p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/45">Not sure which wedding tool to buy?</p><h2 className="mx-auto mt-3 max-w-4xl font-serif text-4xl leading-tight md:text-6xl">Start with the free Wedding Planning Builder. It will show you where your plan is weakest.</h2><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/build" className="rounded-2xl bg-charcoal px-7 py-4 font-bold text-linen shadow-lg">Build my wedding free →</Link><Link href="/shop" className="rounded-2xl border border-charcoal/20 bg-white px-7 py-4 font-bold">Compare All Wedding Tools & Prices →</Link></div></section>
</div>}
