'use client';
import { useEffect, useState } from 'react';
import { products, suite } from '@/lib/products';

type Status = { status: string; message: string; product_name?: string; email?: string; download_url?: string | null };
export function OrderStatus({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<Status>({ status: 'CHECKING', message: 'Verifying your payment and secure access…' });
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    async function check() {
      attempts += 1;
      const response = await fetch(`/api/order-status?session_id=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({ status: 'ERROR', message: 'We could not verify this order yet.' }));
      if (cancelled) return;
      setState(payload);
      if (['PENDING', 'PROCESSING'].includes(payload.status) && attempts < 10) setTimeout(check, 1800);
    }
    check();
    return () => { cancelled = true; };
  }, [sessionId]);

  return <section className="mt-7 rounded-[1.75rem] border border-charcoal/10 bg-white p-6 shadow-soft" aria-live="polite">
    <p className="text-xs font-bold uppercase tracking-[.22em] text-charcoal/45">Secure order status</p>
    <h2 className="mt-3 font-serif text-3xl">{state.product_name || 'Preparing your purchase'}</h2>
    <p className="mt-3 leading-7 text-charcoal/70">{state.message}</p>
    {state.email && <p className="mt-2 text-sm text-charcoal/55">Delivery address: {state.email}</p>}
    {state.download_url && <a className="mt-6 inline-flex rounded-full bg-charcoal px-6 py-4 font-bold text-linen transition hover:-translate-y-0.5" href={state.download_url}>Download {state.product_name}</a>}
    {state.download_url && <AfterPurchase bought={state.product_name} />}
    {state.status === 'AWAITING_ASSET' && <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">Payment is complete. Your file will become available after the production release is uploaded to secure storage. No second payment is required.</p>}
  </section>;
}

// Thank-you-page upsell (Growth playbook): once the download is ready, the other tools,
// each on its own page with its real price. Nothing for a suite buyer: they have all four.
export function AfterPurchase({ bought }: { bought?: string }) {
  if (!bought || bought === suite.name) return null;
  const others = products.filter((p) => p.name !== bought);
  if (others.length === products.length) return null;
  return <div data-testid="after-purchase" className="mt-7 border-t border-charcoal/10 pt-6">
    <p className="text-xs font-bold uppercase tracking-[.22em] text-charcoal/45">Planning the rest</p>
    <p className="mt-2 leading-7 text-charcoal/70">The same planning system covers the other parts of the wedding. Each is a one-time purchase.</p>
    <ul className="mt-4 grid gap-3 md:grid-cols-3">{others.map((p) => <li key={p.id}><a className="block rounded-2xl bg-ivory p-4 font-bold" href={p.canonical_url}>{p.name} — ${p.price} →</a></li>)}</ul>
  </div>;
}
