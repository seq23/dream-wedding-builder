'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { BUILDER_ACCESS_KEY, CONSENT_TEXT, UNSUBSCRIBE_NOTE } from '@/lib/builder-signup';

// The builder stays free, but opens after the visitor leaves an email. The builder
// is still rendered underneath (inert) so the page keeps its content for search and
// returning visitors on this browser go straight in.
export function BuilderEmailGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try { if (localStorage.getItem(BUILDER_ACCESS_KEY)) setUnlocked(true); } catch { /* storage blocked: the form still works */ }
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!consent) { setError('Please tick the box to agree to planning emails.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/builder-signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, consent: true, source: 'free-wedding-planner' }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) { setError(data.error ?? 'Something went wrong. Please try again.'); return; }
      try { localStorage.setItem(BUILDER_ACCESS_KEY, new Date().toISOString()); } catch { /* still unlock this visit */ }
      setUnlocked(true);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (unlocked) return <>{children}</>;
  return <div className="relative">
    <section data-testid="builder-email-gate" className="relative z-10 mx-auto mb-8 max-w-2xl rounded-[2rem] border border-charcoal/10 bg-white p-7 shadow-soft md:p-10">
      <p className="text-xs font-bold uppercase tracking-[.22em] text-charcoal/45">Free wedding planning builder</p>
      <h1 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">Enter your email to open the builder.</h1>
      <p className="mt-4 leading-7 text-charcoal/70">The builder is free. Your plan stays in this browser; we keep only your email address.</p>
      <form onSubmit={submit} className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm font-bold">Email address
          <input data-testid="builder-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-2xl border border-charcoal/20 px-4 py-3 text-base font-normal" placeholder="you@example.com" />
        </label>
        <label className="flex items-start gap-3 text-sm leading-6 text-charcoal/75">
          <input data-testid="builder-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4" />
          <span>{CONSENT_TEXT}</span>
        </label>
        {error ? <p role="alert" className="text-sm font-semibold text-red-700">{error}</p> : null}
        <button data-testid="builder-email-submit" disabled={busy} className="min-h-12 rounded-2xl bg-charcoal px-6 py-3 font-bold text-linen disabled:opacity-60" type="submit">{busy ? 'Opening…' : 'Open the free builder →'}</button>
        <p className="text-xs leading-5 text-charcoal/55">{UNSUBSCRIBE_NOTE} See the <Link className="underline" href="/privacy">privacy page</Link>.</p>
      </form>
    </section>
    <div aria-hidden="true" inert className="pointer-events-none max-h-[900px] select-none overflow-hidden opacity-40 blur-[2px]">{children}</div>
  </div>;
}
