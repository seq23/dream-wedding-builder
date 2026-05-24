import Link from 'next/link';
export function StickyTotal({ total = '$118k–$165k' }: { total?: string }) {
  return <div className="no-print fixed bottom-14 left-3 right-3 z-30 rounded-2xl border border-charcoal/10 bg-charcoal px-4 py-3 text-linen shadow-soft md:bottom-6 md:left-auto md:right-8 md:w-80">
    <div className="flex items-center justify-between gap-4">
      <div><p className="text-xs uppercase tracking-wide text-linen/70">Estimated total</p><p className="font-serif text-xl">{total}</p></div>
      <Link href="/pack" className="rounded-full bg-champagne px-4 py-2 text-sm font-bold text-charcoal">Pack</Link>
    </div>
  </div>;
}
