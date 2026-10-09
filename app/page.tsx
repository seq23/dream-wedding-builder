import Image from 'next/image';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import { CheckoutButton } from '@/components/CheckoutButton';
import { products, suite, supportEmail } from '@/lib/products';

export const metadata: Metadata = {
  title: { absolute: 'Wedding Checklist PDF ($9): Printable, Editable Planning Checklist' },
  description: 'The $9 Wedding Checklist PDF: a 104-row editable checklist and 13-page printable packet with owners, deadlines and final payments. Instant download.',
  alternates: { canonical: 'https://weddingchecklistpdf.com/' },
  openGraph: { title: 'Wedding Checklist PDF — $9', description: 'A 104-row editable wedding checklist and 13-page printable planning packet. One-time $9, instant download.', url: 'https://weddingchecklistpdf.com/', type: 'website' }
};

const checklist = products.find((p) => p.id === 'checklist-pdf')!;
const bundleSeparate = products.reduce((sum, p) => sum + p.price, 0);
const bundleSavings = bundleSeparate - suite.price;

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
        <p className="inline-flex w-fit rounded-full bg-rose/20 px-4 py-2 text-[11px] font-bold uppercase tracking-[.2em] text-charcoal/70">The Wedding Checklist PDF · $9</p>
        <h1 className="mt-5 font-serif text-5xl leading-[.98] sm:text-6xl lg:text-7xl">The wedding checklist<br/>built around<br/><em className="font-normal text-[#a88032]">your actual date.</em></h1>
        <p className="mt-6 max-w-xl text-base leading-7 text-charcoal/70 md:text-lg md:leading-8">{checklist.promise}</p>
        <ul className="mt-5 grid gap-2 text-sm font-semibold text-charcoal/75">{checklist.features.slice(0, 4).map((f) => <li key={f}>✓ {f}</li>)}</ul>
        <div className="mt-8 max-w-md" data-testid="home-primary-cta"><CheckoutButton sku={checklist.sku} price={checklist.price} label={`Get the Wedding Checklist PDF — $${checklist.price}`} productName={checklist.name}/></div>
        <p className="mt-3 text-sm text-charcoal/55">{checklist.value_note}. Secure checkout by Stripe.</p>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold"><Link href={checklist.route} className="underline underline-offset-4">Look inside the checklist first →</Link><Link href="/shop" className="underline underline-offset-4">All four tools in one bundle — $39</Link></div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[.2em] text-charcoal/45">Or pick the tool you need</p>
        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <a href="https://weddingseatingchartmaker.com/products/seating-chart-maker" className="rounded-xl border border-charcoal/10 bg-linen/70 px-4 py-3 font-bold transition hover:border-charcoal/25 hover:bg-linen">Wedding Seating Chart Maker — $19</a>
          <a href="https://weddingbudgetspreadsheet.com/products/budget-spreadsheet" className="rounded-xl border border-charcoal/10 bg-linen/70 px-4 py-3 font-bold transition hover:border-charcoal/25 hover:bg-linen">Wedding Budget Spreadsheet — $12</a>
          <a href="https://weddingtimelinetemplate.com/products/timeline-template" className="rounded-xl border border-charcoal/10 bg-linen/70 px-4 py-3 font-bold transition hover:border-charcoal/25 hover:bg-linen">Wedding Timeline Template — $12</a>
          <Link href="/products/operations-suite" className="rounded-xl border border-charcoal/10 bg-linen/70 px-4 py-3 font-bold transition hover:border-charcoal/25 hover:bg-linen">Operations Suite bundle — $39</Link>
        </div>
      </div>
      <div className="relative min-h-[420px] bg-linen sm:min-h-[520px] lg:min-h-[650px]"><Image src={checklist.hero_image} alt="Wedding Checklist PDF: the printable planning packet and editable master checklist" fill priority sizes="(max-width:1024px) 100vw, 58vw" className="object-cover"/></div>
    </div>
  </section>

  <section className="rounded-[2rem] border border-charcoal/10 bg-white p-7 md:p-10">
    <p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/45">Planning guides</p>
    <h2 className="mt-3 font-serif text-4xl md:text-6xl">Read the method, then put it to work.</h2>
    <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {[
        ['Complete Wedding Checklist','/wedding-checklist'],
        ['Step-by-Step Planning Checklist','/wedding-planning-checklist'],
        ['Wedding Checklist PDF Guide','/wedding-checklist-pdf'],
        ['Printable Wedding Checklist','/printable-wedding-checklist']
      ].map(([label,href])=><Link key={href} href={href} className="rounded-[1.25rem] bg-ivory p-5 font-serif text-2xl transition hover:bg-linen">{label} →</Link>)}
    </div>
    <div className="mt-5 grid gap-3 md:grid-cols-3">
      <a href="https://weddingbudgetspreadsheet.com/wedding-budget-spreadsheet" className="rounded-2xl border border-charcoal/10 p-4 font-bold">Wedding Budget Spreadsheet Guide →</a>
      <a href="https://weddingtimelinetemplate.com/wedding-timeline-template" className="rounded-2xl border border-charcoal/10 p-4 font-bold">Wedding Timeline Template Guide →</a>
      <a href="https://weddingseatingchartmaker.com/wedding-seating-chart" className="rounded-2xl border border-charcoal/10 p-4 font-bold">Wedding Seating Chart Guide →</a>
    </div>
  </section>

  <section>
    <div className="mx-auto max-w-4xl text-center"><p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/45">Choose the wedding tool you need most</p><h2 className="mt-3 font-serif text-4xl leading-tight md:text-6xl">Four high-stress wedding jobs. Four finished solutions.</h2><p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-charcoal/65 md:text-lg">Every product card shows the full product name and price before you click. Every product page explains the files, outcome, delivery process, and limitations before checkout.</p></div>
    <div className="mt-9 grid gap-6 md:grid-cols-2 xl:grid-cols-4">{products.map(p=><ProductCard key={p.id} product={p}/>)}</div>
  </section>

  <section data-testid="bundle" className="overflow-hidden rounded-[2rem] bg-charcoal text-linen shadow-[0_30px_80px_rgba(39,35,31,.2)]"><div className="grid lg:grid-cols-[.9fr_1.1fr]"><div className="p-7 md:p-10 lg:p-12"><p className="inline-flex rounded-full bg-[#c79425] px-4 py-2 text-xs font-bold uppercase tracking-[.18em] text-white">Bundle — save ${bundleSavings}</p><h2 className="mt-5 font-serif text-5xl md:text-6xl">{suite.name}: all four tools for ${suite.price}</h2>
    <table className="mt-6 w-full max-w-md text-sm"><tbody>{products.map((p) => <tr key={p.id} className="border-b border-linen/15"><td className="py-2 text-linen/85">{p.name}</td><td className="py-2 text-right text-linen/85">${p.price}</td></tr>)}
      <tr className="border-b border-linen/15"><td className="py-2 text-linen/60">Bought separately</td><td className="py-2 text-right text-linen/60 line-through">${bundleSeparate}</td></tr>
      <tr><td className="py-2 font-bold">Bundle price</td><td className="py-2 text-right text-xl font-bold">${suite.price}</td></tr></tbody></table>
    <p className="mt-3 font-bold text-[#e6c06a]">You save ${bundleSavings} ({Math.round((bundleSavings / bundleSeparate) * 100)}%) against buying the four tools one at a time.</p>
    <div className="mt-8 max-w-md"><CheckoutButton sku={suite.sku} price={suite.price} label={`Get the bundle — $${suite.price} (save $${bundleSavings})`} productName={suite.name}/></div><p className="mt-3 text-sm text-linen/55">One-time payment • Instant protected access • No subscription</p></div><div className="relative min-h-[420px] lg:min-h-full"><Image src="/product-images/operations-suite.png" alt="All four Dream Wedding planning tools included in the $39 Operations Suite" fill sizes="(max-width:1024px) 100vw, 55vw" className="object-cover"/></div></div></section>

  <section className="grid gap-8 lg:grid-cols-[1.35fr_.65fr]">
    <div><p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/45">Why couples pay for these tools</p><h2 className="mt-3 font-serif text-4xl md:text-6xl">Free inspiration is easy. Final-mile execution is not.</h2><p className="mt-4 max-w-3xl text-lg leading-8 text-charcoal/65">These products are built around the handoffs and mistakes that create expensive wedding-week stress: unassigned guests, hidden balances, missing owners, impossible timing, and generic task lists.</p><div className="mt-8 grid gap-4 sm:grid-cols-2">{trust.map(([h,b])=><article className="rounded-[1.5rem] border border-charcoal/8 bg-white p-6 shadow-soft" key={h}><h3 className="font-serif text-2xl">{h}</h3><p className="mt-3 text-sm leading-6 text-charcoal/65">{b}</p></article>)}</div></div>
    <aside className="rounded-[2rem] bg-linen p-7 md:p-9"><p className="text-xs font-bold uppercase tracking-[.22em] text-charcoal/45">How it works</p><h2 className="mt-3 font-serif text-4xl">From purchase to usable handoff in four steps.</h2><ol className="mt-7 space-y-5 text-charcoal/70">{[['1','Choose your tool','Buy one clearly priced product or the complete suite.'],['2','Pay securely','Stripe handles checkout and payment verification.'],['3','Receive access','Verified purchases unlock protected files on screen and by email.'],['4','Customize and hand off','Use the editable files with your partner, venue, vendors, or coordinator.']].map(([n,h,b])=><li key={n} className="grid grid-cols-[2rem_1fr] gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-charcoal text-sm font-bold text-linen">{n}</span><div><strong className="block text-charcoal">{h}</strong><span className="text-sm leading-6">{b}</span></div></li>)}</ol></aside>
  </section>

  <section className="rounded-[2rem] bg-rose/20 p-7 text-center md:p-12"><p className="text-xs font-bold uppercase tracking-[.25em] text-charcoal/45">Not sure where your plan is weakest?</p><h2 className="mx-auto mt-3 max-w-4xl font-serif text-4xl leading-tight md:text-6xl">Run your plan through the Wedding Planning Builder, then pick the tool that fixes the gap.</h2><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/free-wedding-planner" className="rounded-2xl bg-charcoal px-7 py-4 font-bold text-linen shadow-lg">Open the planning builder →</Link><Link href="/shop" className="rounded-2xl border border-charcoal/20 bg-white px-7 py-4 font-bold">Compare All Wedding Tools & Prices →</Link></div></section>
</div>}
