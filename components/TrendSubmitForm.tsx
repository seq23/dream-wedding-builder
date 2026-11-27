'use client';
import { useState } from 'react';
import { ConversionAnalytics } from '@/components/ConversionAnalytics';
import { IDEA_NOT_SAVED } from '@/lib/trend-ideas';
// The standout-idea submission form. Lived on /trends until that page folded into the
// homepage's #standout-ideas section on 25 Nov 2026 (Search Readiness f4).
export const RECEIVED = 'Thank you — we received your idea. The ones that fit may be added to the standout ideas.';
const NOT_SAVED = IDEA_NOT_SAVED;
/** Sends one idea and returns the line the visitor sees. "Received" only when the server answered
 *  ok, which it does only after the idea is saved (app/api/submit-trend/route.ts); any other answer
 *  shows the server's own reason, or a plain "not saved" when there is none (offline, not JSON). */
export async function sendIdea(body: Record<string, unknown>, send: typeof fetch = fetch): Promise<string> {
  try {
    const res = await send('/api/submit-trend', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const answer = await res.json().catch(() => null) as { ok?: boolean; error?: unknown } | null;
    if (res.ok && answer?.ok === true) return RECEIVED;
    return typeof answer?.error === 'string' && answer.error.trim() ? answer.error : NOT_SAVED;
  } catch {
    return NOT_SAVED;
  }
}
export default function TrendSubmitForm() {
  const [status, setStatus] = useState('');
  async function submit(formData: FormData) {
    setStatus('Submitting...');
    const body = Object.fromEntries(formData.entries());
    setStatus(await sendIdea(body));
  }
  return <form action={submit} className="mt-5 grid gap-3" data-testid="trend-submit-form" data-session-recording><ConversionAnalytics /><input className="hidden" name="company" tabIndex={-1} autoComplete="off" /><div className="grid gap-3 md:grid-cols-2"><input required name="idea_name" maxLength={120} placeholder="Trend / idea name" className="rounded-2xl border border-charcoal/10 p-3" /><select name="category" className="rounded-2xl border border-charcoal/10 p-3"><option>Guest Experience</option><option>Ceremony</option><option>Reception</option><option>Fashion</option><option>Flowers</option><option>Decor</option><option>Food + Drink</option><option>Destination</option><option>Luxury</option><option>Quirky</option></select></div><textarea required name="description" maxLength={1000} placeholder="What is it?" className="min-h-28 rounded-2xl border border-charcoal/10 p-3" /><div className="grid gap-3 md:grid-cols-3"><select name="source_type" className="rounded-2xl border border-charcoal/10 p-3"><option>TikTok</option><option>Instagram</option><option>Pinterest</option><option>Wedding I attended</option><option>Planner</option><option>Venue</option><option>Other</option></select><input name="source_url" maxLength={500} placeholder="Link, if you have one" className="rounded-2xl border border-charcoal/10 p-3" /><select name="budget_feel" className="rounded-2xl border border-charcoal/10 p-3"><option>No idea</option><option>Cheap</option><option>Affordable</option><option>Standard</option><option>Luxury</option><option>Ultra Luxe</option></select></div><textarea name="why_cool" maxLength={750} placeholder="Why is it cool?" className="min-h-24 rounded-2xl border border-charcoal/10 p-3" /><label className="flex gap-2 text-sm"><input type="checkbox" name="price_this_out" /> Should we price this out?</label><p className="text-xs text-midnight-muted">Please do not submit private information, copyrighted text, confidential vendor quotes, personal contact details, or anything you do not have permission to share.</p><button className="rounded-full bg-charcoal px-6 py-3 font-bold text-linen">Submit idea</button>{status && <p data-testid="trend-submit-status" className="rounded-2xl bg-ivory p-3 text-sm">{status}</p>}</form>;
}
