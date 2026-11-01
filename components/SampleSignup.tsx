'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { UNSUBSCRIBE_NOTE } from '@/lib/builder-signup';
import { ConversionAnalytics } from '@/components/ConversionAnalytics';

const SAMPLE_PDF = '/samples/wedding-checklist-sample.pdf';
const SAMPLE_CONSENT = 'Email me the free sample, then a few short planning emails about the Dream Wedding Builder tools (one every few days at most). I can unsubscribe at any time.';

// Free sample -> email -> paid (lib/nurture.ts). Three real pages of the Wedding
// Checklist PDF for a typed-in address. The page also shows the PDF link once the
// address is in, so nobody is left waiting on an email.
// privacyHref comes from hrefFrom() on pages served on a product host, so the link never hops hosts.
export function SampleSignup({ heading = 'Try 3 pages of the checklist free', privacyHref = '/privacy' }: { heading?: string; privacyHref?: string }) {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!consent) { setError('Please tick the box so we can email the sample.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/sample', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, consent: true }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) { setError(data.error ?? 'Something went wrong. Please try again.'); return; }
      setDone(true);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <section data-testid="sample-signup" className="no-print rounded-[2rem] border border-charcoal/10 bg-ivory p-7 md:p-10">
    <p className="text-xs font-bold uppercase tracking-[.22em] text-charcoal/45">Free sample</p>
    <h2 className="mt-3 font-serif text-4xl leading-tight">{heading}</h2>
    <p className="mt-3 max-w-2xl leading-7 text-charcoal/70">How to use it, the critical-path page and the 12 to 9 months page, as a printable PDF.</p>
    {done ? <p className="mt-6 rounded-2xl bg-white p-5 font-semibold">Sent. You can also <a className="underline" href={SAMPLE_PDF}>open the sample now</a>.</p> :
    <form onSubmit={submit} className="mt-6 grid max-w-xl gap-4" data-session-recording>
      <ConversionAnalytics />
      <label className="grid gap-2 text-sm font-bold">Email address
        <input data-testid="sample-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-2xl border border-charcoal/20 bg-white px-4 py-3 text-base font-normal" placeholder="you@example.com" />
      </label>
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <label className="flex items-start gap-3 text-sm leading-6 text-charcoal/75">
        <input data-testid="sample-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4" />
        <span>{SAMPLE_CONSENT}</span>
      </label>
      {error ? <p role="alert" className="text-sm font-semibold text-red-700">{error}</p> : null}
      <button data-testid="sample-submit" disabled={busy} className="min-h-12 rounded-2xl bg-charcoal px-6 py-3 font-bold text-linen disabled:opacity-60" type="submit">{busy ? 'Sending…' : 'Email me the free sample →'}</button>
      <p className="text-xs leading-5 text-charcoal/55">{UNSUBSCRIBE_NOTE} See the <Link className="underline" href={privacyHref}>privacy page</Link>.</p>
    </form>}
  </section>;
}
