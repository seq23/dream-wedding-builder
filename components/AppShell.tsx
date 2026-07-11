'use client';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';

const productNav = [
  ['Wedding Seating Chart Maker — $19','/products/seating-chart-maker'],
  ['Wedding Budget Spreadsheet — $12','/products/budget-spreadsheet'],
  ['Wedding Timeline Template — $12','/products/timeline-template'],
  ['Wedding Checklist PDF — $9','/products/checklist-pdf'],
  ['All Four Wedding Tools — $39','/shop']
];

export function AppShell({children}:{children:ReactNode}){
  const [open,setOpen]=useState(false);
  return <div className="min-h-screen">
    <div className="no-print bg-rose/20 px-4 py-2.5 text-center text-xs font-semibold text-charcoal">Four paid wedding tools. One free planning foundation. <Link href="/build" className="ml-1 font-bold underline underline-offset-4">Build your wedding plan free →</Link></div>
    <header className="no-print sticky top-0 z-50 border-b border-charcoal/10 bg-ivory/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 md:px-6">
        <Link href="/" className="shrink-0 font-serif text-xl leading-none tracking-[.08em] md:text-2xl"><span className="block">DREAM WEDDING</span><span className="mt-1 block text-sm tracking-[.24em]">BUILDER</span></Link>
        <nav className="hidden items-center gap-1 xl:flex" aria-label="Primary navigation">{productNav.map(([label,href])=><Link key={href} className="rounded-xl px-3 py-2 text-[13px] font-semibold transition hover:bg-white" href={href}>{label}</Link>)}<Link className="rounded-xl px-3 py-2 text-[13px] font-semibold transition hover:bg-white" href="/build">Free Wedding Planning Builder</Link></nav>
        <div className="flex items-center gap-2"><Link href="/shop" className="hidden rounded-2xl bg-charcoal px-4 py-3 text-sm font-bold text-linen shadow-sm md:inline-flex">Compare tools & prices</Link><button onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-label="Toggle navigation" className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-charcoal/15 bg-white text-xl xl:hidden">{open?'×':'☰'}</button></div>
      </div>
      {open&&<nav className="border-t border-charcoal/10 bg-white px-4 py-4 xl:hidden" aria-label="Mobile navigation"><div className="mx-auto grid max-w-3xl gap-2">{productNav.map(([label,href])=><Link onClick={()=>setOpen(false)} key={href} className="rounded-xl bg-linen px-4 py-3 text-sm font-bold" href={href}>{label}</Link>)}<Link onClick={()=>setOpen(false)} className="rounded-xl bg-charcoal px-4 py-3 text-sm font-bold text-linen" href="/build">Free Wedding Planning Builder →</Link></div></nav>}
    </header>
    <main className="mx-auto max-w-[1440px] px-4 py-6 md:px-6 md:py-10">{children}</main>
    <footer className="mt-20 bg-charcoal text-linen"><div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-12 md:grid-cols-4 md:px-8"><div><p className="font-serif text-2xl tracking-wide">Dream Wedding Builder</p><p className="mt-3 text-sm leading-6 text-linen/65">Four paid execution tools. One free planning foundation.</p></div><div><p className="font-bold">Wedding planning tools</p><div className="mt-3 grid gap-2 text-sm text-linen/75">{productNav.map(([label,href])=><Link key={href} href={href}>{label}</Link>)}</div></div><div><p className="font-bold">Customer support</p><a className="mt-3 block underline" href="mailto:info@weddingchecklistpdf.com">info@weddingchecklistpdf.com</a><p className="mt-3 text-xs leading-5 text-linen/55">All four product domains use one support desk.</p></div><div className="grid content-start gap-2 text-sm text-linen/75"><Link href="/privacy">Privacy Policy</Link><Link href="/disclaimer">Disclaimer</Link><Link href="/terms">Terms of Use</Link><Link href="/refund-policy">Digital Product Refund Policy</Link></div></div></footer>
  </div>;
}
