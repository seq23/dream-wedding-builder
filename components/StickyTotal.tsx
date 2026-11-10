'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// Hidden while the Working Plan card is on screen: it shows the same total, and on a
// laptop the fixed bar sat over that card's Save button (laptop review, 6 Nov 2026).
export function StickyTotal({ total = '$118k–$165k' }: { total?: string }) {
  const [summaryOnScreen, setSummaryOnScreen] = useState(false);
  useEffect(() => {
    const card = document.querySelector('[data-testid="canonical-plan-summary"]');
    if (!card || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setSummaryOnScreen(entry.isIntersecting), { threshold: 0 });
    io.observe(card);
    return () => io.disconnect();
  }, []);
  return <div data-testid="sticky-total" className={`no-print fixed bottom-6 right-8 z-30 hidden w-80 rounded-2xl border border-charcoal/10 bg-charcoal px-4 py-3 text-linen shadow-soft ${summaryOnScreen ? '' : 'md:block'}`}>
    <div className="flex items-center justify-between gap-4">
      <div><p className="text-xs uppercase tracking-wide text-linen/70">Estimated total</p><p className="font-serif text-xl">{total}</p></div>
      <Link href="/pack" className="inline-flex min-h-11 items-center rounded-full bg-blue px-4 py-2 text-sm font-bold text-white">Pack</Link>
    </div>
  </div>;
}
