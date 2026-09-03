'use client';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { PlannerCtaProvider } from '@/components/PlannerCta';
import { PLANNER_ABSOLUTE } from '@/lib/planner-seed';
import type { DirectoryLink } from '@/lib/site-directory';

const products = [
  { label: 'Wedding Seating Chart Maker — $19', href: 'https://weddingseatingchartmaker.com/products/seating-chart-maker' },
  { label: 'Wedding Budget Spreadsheet — $12', href: 'https://weddingbudgetspreadsheet.com/products/budget-spreadsheet' },
  { label: 'Wedding Timeline Template — $12', href: 'https://weddingtimelinetemplate.com/products/timeline-template' },
  { label: 'Wedding Checklist PDF — $9', href: 'https://weddingchecklistpdf.com/products/checklist-pdf' },
  { label: 'All Four Wedding Tools — $39', href: 'https://weddingchecklistpdf.com/shop' }
];
const siteLinks: Record<string, { label: string; hub: string; product: string }> = {
  'weddingchecklistpdf.com': { label: 'Wedding Checklist', hub: '/wedding-checklist', product: '/products/checklist-pdf#look-inside' },
  'weddingbudgetspreadsheet.com': { label: 'Wedding Budget', hub: '/wedding-budget-spreadsheet', product: '/products/budget-spreadsheet#look-inside' },
  'weddingtimelinetemplate.com': { label: 'Wedding Timeline', hub: '/wedding-timeline-template', product: '/products/timeline-template#look-inside' },
  'weddingseatingchartmaker.com': { label: 'Wedding Seating', hub: '/wedding-seating-chart', product: '/products/seating-chart-maker#look-inside' }
};

export function AppShell({ children, siteHost, directory = [] }: { children: ReactNode; siteHost: string; directory?: DirectoryLink[] }) {
  const [open, setOpen] = useState(false);
  const site = siteLinks[siteHost] ?? siteLinks['weddingchecklistpdf.com'];
  // Grouped in render order; lib/site-directory.ts already sorted by group.
  const directoryGroups = directory.reduce<{ group: string; links: DirectoryLink[] }[]>((groups, link) => {
    const last = groups[groups.length - 1];
    if (last && last.group === link.group) last.links.push(link); else groups.push({ group: link.group, links: [link] });
    return groups;
  }, []);
  const currentHome = siteHost === 'weddingchecklistpdf.com' ? '/' : site.hub;
  return <div className="min-h-screen">
    {/* The most valuable slot on the site - full width, above the nav, on every page
        of every domain - used to carry a purchase-anxiety reducer aimed at people
        who had not decided to buy anything. It now carries the free tool, which is
        the thing a search visitor can actually use on arrival. "Look inside the
        files" is still one click away in the nav, the footer, and on every product
        page, where it answers a question the reader has by then actually asked. */}
    <div data-testid="planner-banner" className="no-print bg-rose/20 px-4 py-2.5 text-center text-xs font-semibold text-charcoal">Free, no account, nothing leaves your browser. <a href={PLANNER_ABSOLUTE} className="ml-1 font-bold underline underline-offset-4">Open the free wedding planner →</a></div>
    <header className="no-print sticky top-0 z-50 border-b border-charcoal/10 bg-ivory/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 md:px-6">
        <Link href={currentHome} className="shrink-0 font-serif text-xl leading-none tracking-[.08em] md:text-2xl"><span className="block">DREAM WEDDING</span><span className="mt-1 block text-sm tracking-[.24em]">BUILDER</span></Link>
        <nav className="hidden items-center gap-1 xl:flex" aria-label="Primary navigation"><Link className="rounded-xl px-3 py-2 text-[13px] font-semibold transition hover:bg-white" href={site.hub}>{site.label} Hub</Link><Link className="rounded-xl px-3 py-2 text-[13px] font-semibold transition hover:bg-white" href="/guides">Guides</Link><a data-testid="desktop-nav-planner" className="rounded-xl border border-charcoal/25 bg-white px-3 py-2 text-[13px] font-bold transition hover:bg-linen" href={PLANNER_ABSOLUTE}>Free Planner</a>{products.slice(0, 4).map((item) => <a key={item.href} className="rounded-xl px-3 py-2 text-[13px] font-semibold transition hover:bg-white" href={item.href}>{item.label.split(' — ')[0]}</a>)}</nav>
        <div className="flex items-center gap-2"><a href="https://weddingchecklistpdf.com/shop" className="hidden rounded-2xl bg-charcoal px-4 py-3 text-sm font-bold text-linen shadow-sm md:inline-flex">Compare tools & prices</a><button onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Toggle navigation" className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-charcoal/15 bg-white text-xl xl:hidden">{open ? '×' : '☰'}</button></div>
      </div>
      {open && <nav className="border-t border-charcoal/10 bg-white px-4 py-4 xl:hidden" aria-label="Mobile navigation"><div className="mx-auto grid max-w-3xl gap-2"><Link onClick={() => setOpen(false)} className="rounded-xl bg-linen px-4 py-3 text-sm font-bold" href={site.hub}>{site.label} Hub</Link><Link onClick={() => setOpen(false)} className="rounded-xl bg-linen px-4 py-3 text-sm font-bold" href="/guides">Guides</Link><Link onClick={() => setOpen(false)} className="rounded-xl bg-linen px-4 py-3 text-sm font-bold" href={site.product}>Look Inside the Paid Files</Link>{products.map((item) => <a onClick={() => setOpen(false)} key={item.href} className="rounded-xl bg-linen px-4 py-3 text-sm font-bold" href={item.href}>{item.label}</a>)}<a onClick={() => setOpen(false)} className="rounded-xl bg-charcoal px-4 py-3 text-sm font-bold text-linen" href={PLANNER_ABSOLUTE}>Browser-based Wedding Planning Builder →</a></div></nav>}
    </header>
    <PlannerCtaProvider><main className="mx-auto max-w-[1440px] px-4 py-6 md:px-6 md:py-10">{children}</main></PlannerCtaProvider>
    <footer className="no-print mt-20 bg-charcoal text-linen"><div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-12 md:grid-cols-4 md:px-8"><div><p className="font-serif text-2xl tracking-wide">Dream Wedding Builder</p><p className="mt-3 text-sm leading-6 text-linen/65">Planning guides, transparent product previews, and four paid execution tools.</p></div><div><p className="font-bold">Wedding planning tools</p><div className="mt-3 grid gap-2 text-sm text-linen/75">{products.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}</div></div><div><p className="font-bold">Resources</p><div className="mt-3 grid gap-2 text-sm text-linen/75"><Link href={site.hub}>{site.label} Hub</Link><Link href="/guides">Guides</Link><Link href={site.product}>Look Inside the Paid Files</Link><a href={PLANNER_ABSOLUTE}>Browser-based Planning Builder</a></div></div><div className="grid content-start gap-2 text-sm text-linen/75"><a href="mailto:info@weddingchecklistpdf.com">info@weddingchecklistpdf.com</a><a href="https://weddingchecklistpdf.com/privacy">Privacy Policy</a><a href="https://weddingchecklistpdf.com/disclaimer">Disclaimer</a><a href="https://weddingchecklistpdf.com/terms">Terms of Use</a><a href="https://weddingchecklistpdf.com/refund-policy">Digital Product Refund Policy</a></div></div>
      {/* Site directory. Derived from data/seo/route_ownership.json, which is the
          same file that produces the sitemap, so a page cannot be published to
          crawlers without also being linked from every page of its own host.
          Before this existed, five /amazon/ book companion pages and one planner
          landing page were in the sitemap with no inbound internal link at all -
          published, crawlable, and unable to receive or pass any authority. */}
      {directoryGroups.length > 0 && <div data-testid="site-directory" className="border-t border-linen/15"><div className="mx-auto max-w-[1440px] px-5 py-10 md:px-8"><p className="text-xs font-bold uppercase tracking-[.24em] text-linen/45">Everything on this site</p><div className="mt-6 grid gap-8 md:grid-cols-4">{directoryGroups.map((group) => <div key={group.group}><p className="text-sm font-bold text-linen/85">{group.group}</p><ul className="mt-3 grid gap-2 text-sm text-linen/65">{group.links.map((link) => <li key={link.href}><a href={link.href} className="hover:text-linen hover:underline">{link.label}</a></li>)}</ul></div>)}</div></div></div>}
    </footer>
  </div>;
}
