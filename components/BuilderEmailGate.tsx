'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { BUILDER_ACCESS_KEY, BUILDER_EMAIL_KEY, CONSENT_TEXT, UNSUBSCRIBE_NOTE } from '@/lib/builder-signup';

// A signup that came from a tool site's "Open the free wedding planner" button (her yes
// 7 Nov 2026, look 3) is stored as free-wedding-planner:<tool host>, so the scorecard can
// count it. Only the three tool hosts are accepted; anything else is the plain source.
const TOOL_HOSTS = ['weddingseatingchartmaker.com', 'weddingtimelinetemplate.com', 'weddingbudgetspreadsheet.com'];
export function signupSource(search: string = typeof window === 'undefined' ? '' : window.location.search) {
  const from = new URLSearchParams(search).get('from') ?? '';
  return TOOL_HOSTS.includes(from) ? `free-wedding-planner:${from}` : 'free-wedding-planner';
}

/** Stores the address she gave. `marketing` is her own optional tick; false means no marketing email, ever. */
export async function signUp(email: string, marketing: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/builder-signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, marketing, source: signupSource() }) });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) return { ok: false, error: data.error ?? 'Something went wrong. Please try again.' };
    try { localStorage.setItem(BUILDER_ACCESS_KEY, new Date().toISOString()); localStorage.setItem(BUILDER_EMAIL_KEY, email.trim().toLowerCase()); } catch { /* still open for this visit */ }
    window.dispatchEvent(new Event('dwb-builder-unlocked'));
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach the server. Please try again.' };
  }
}

/** The optional, unticked marketing box. Shared by every place an email is asked for. */
export function MarketingTick({ checked, onChange, id }: { checked: boolean; onChange: (value: boolean) => void; id: string }) {
  return <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-6 text-charcoal/75">
    <input id={id} data-testid="builder-consent" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-6 w-6 shrink-0 accent-blue" />
    <span>Optional: {CONSENT_TEXT}</span>
  </label>;
}

// The plan comes first and the email second (owner, 10 Nov 2026): a stranger sees her
// dated plan with no email. The email is asked once, inline, at the moments it buys
// her something (the printable plan, the free AI draft), never as a wall in front of
// the plan. The marketing box is separate, optional and unticked; an address given
// without it gets no marketing email (lib/nurture.ts). No session recording loads here.
export function EmailAsk({ heading, lead, button, children }: { heading: string; lead: string; button: string; children: ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const read = () => { try { setUnlocked(Boolean(localStorage.getItem(BUILDER_ACCESS_KEY))); } catch { setUnlocked(false); } };
    read();
    window.addEventListener('dwb-builder-unlocked', read);
    return () => window.removeEventListener('dwb-builder-unlocked', read);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    setBusy(true);
    const result = await signUp(email, marketing);
    setBusy(false);
    if (!result.ok) { setError(result.error ?? 'Something went wrong. Please try again.'); return; }
    setUnlocked(true);
  }

  if (unlocked === null) return null;
  if (unlocked) return <>{children}</>;
  return <section data-testid="builder-email-gate" className="mx-auto max-w-2xl rounded-[12px] border border-charcoal/15 bg-white p-6 md:p-8">
    <h2 className="font-serif text-3xl leading-tight">{heading}</h2>
    <p className="mt-3 leading-7 text-charcoal/70">{lead}</p>
    <form onSubmit={submit} noValidate className="mt-5 grid gap-4">
      <label className="grid gap-2 text-sm font-bold">Email address
        <input data-testid="builder-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-11 rounded-2xl border border-charcoal/20 px-4 py-3 text-base font-normal" placeholder="you@example.com" />
      </label>
      <MarketingTick id="ask-marketing" checked={marketing} onChange={setMarketing} />
      {error ? <p role="alert" className="text-sm font-semibold text-red-pen">{error}</p> : null}
      <button data-testid="builder-email-submit" disabled={busy} className="min-h-12 rounded-2xl bg-blue px-6 py-3 font-bold text-white disabled:opacity-60" type="submit">{busy ? 'Opening…' : button}</button>
      <p className="text-xs leading-5 text-charcoal/60">Leave the box unticked and we send you no marketing email. {UNSUBSCRIBE_NOTE} See the <Link className="underline" href="/privacy">privacy page</Link>.</p>
    </form>
  </section>;
}
