'use client';
import { useState } from 'react';

// One field, one button: a buyer gets her links again with the email she bought with.
// The server answers the same way whether or not it found a purchase (lib/fresh-link.ts).
export function FreshLinkForm() {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setResult(null);
    try {
      const res = await fetch('/api/fresh-link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, company }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
      setResult(res.ok && data.ok ? { ok: true, text: data.message ?? '' } : { ok: false, text: data.error ?? 'We could not send your link just now. Please try again in a few minutes.' });
    } catch {
      setResult({ ok: false, text: 'We could not reach the server. Check your connection and try again.' });
    } finally { setBusy(false); }
  }

  if (result?.ok) return <p role="status" data-testid="fresh-link-sent" className="mt-5 rounded-2xl border border-charcoal/15 bg-white p-4 leading-7">{result.text}</p>;
  return <form onSubmit={submit} data-testid="fresh-link-form" className="mt-5 grid max-w-md gap-3">
    <label className="grid gap-2 text-sm font-semibold" htmlFor="fresh-link-email">The email you bought with
      <input id="fresh-link-email" data-testid="fresh-link-email" type="email" required autoComplete="email" inputMode="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className="min-h-12 rounded-2xl border border-charcoal/20 bg-white px-3 text-base font-normal" />
    </label>
    <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" value={company} onChange={e => setCompany(e.target.value)} className="hidden" />
    <button type="submit" disabled={busy} data-testid="fresh-link-submit" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue px-6 py-3 font-bold text-white disabled:opacity-60">{busy ? 'Sending…' : 'Email me a fresh link'}</button>
    {result ? <p role="alert" data-testid="fresh-link-error" className="text-sm leading-6 text-red-800">{result.text}</p> : null}
  </form>;
}
