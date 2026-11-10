'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AI_CONSENT_TEXT, AI_DRAFT_USED_TEXT, BUILDER_ACCESS_KEY, BUILDER_EMAIL_KEY } from '@/lib/builder-signup';
import type { AiDraftFields } from '@/lib/ai-draft';
import { budgetModes, type WeddingPlan } from '@/data/planning';
import { plainDate } from '@/lib/dated-plan';

// "Describe your wedding" -> an AI-drafted plan the couple then edits by hand.
// Shown only when the server says the step is on (kill switch, lib/ai-draft.ts).
// Everything the model returns is rendered as plain React text, never as HTML.

const MIN_LENGTH = 10;

/** Fills only fields the couple has left empty: an AI draft never overwrites their own work. */
export function applyAiDraft(plan: WeddingPlan, draft: AiDraftFields, description: string, at: string, byAi = true): { plan: WeddingPlan; filled: string[]; kept: string[] } {
  const next: WeddingPlan = { ...plan };
  const filled: string[] = [];
  const kept: string[] = [];
  for (const key of ['weddingDate', 'guestCount', 'locations', 'season', 'budgetTarget'] as const) {
    if (!draft[key]) continue;
    if (plan[key]) { kept.push(key); continue; }
    next[key] = draft[key];
    filled.push(key);
  }
  if (draft.budgetMode && (plan.budgetMode === 'unknown' || !plan.budgetMode)) { next.budgetMode = draft.budgetMode; filled.push('budgetMode'); }
  if (draft.priorities.length) { if (plan.priorities.length) kept.push('priorities'); else { next.priorities = draft.priorities; filled.push('priorities'); } }
  next.aiDraft = { at, description, fields: filled, notes: draft.notes, byAi };
  return { plan: next, filled, kept };
}

/** True when her sentence named no day of the month, so the day in the date is the draft's guess. */
export function dayWasGuessed(description: string, isoDate: string): boolean {
  const day = Number(isoDate.slice(8, 10));
  if (!day) return false;
  return !new RegExp(`(^|[^0-9])0?${day}(st|nd|rd|th)?([^0-9]|$)`).test(description);
}

export interface DraftValue { field: string; label: string; value: string; href: string }

/**
 * What the draft filled, as the values themselves with the place to change each one
 * (hostile review, 10 Nov 2026: the card listed field names, and the values were not
 * on screen until she opened a step).
 */
export function draftValues(plan: WeddingPlan): DraftValue[] {
  const draft = plan.aiDraft;
  if (!draft) return [];
  const out: DraftValue[] = [];
  for (const field of draft.fields) {
    if (field === 'weddingDate' && plan.weddingDate) out.push({ field, label: 'Date', value: `${plainDate(plan.weddingDate)}${dayWasGuessed(draft.description, plan.weddingDate) ? ' (the day is a guess; you gave the month)' : ''}`, href: '#your-date' });
    if (field === 'guestCount' && plan.guestCount) out.push({ field, label: 'Guests', value: plan.guestCount, href: '#step-0' });
    if (field === 'locations' && plan.locations) out.push({ field, label: 'Place', value: plan.locations, href: '#step-0' });
    if (field === 'season' && plan.season) out.push({ field, label: 'Season', value: plan.season, href: '#step-0' });
    if (field === 'budgetTarget' && plan.budgetTarget) out.push({ field, label: 'Budget', value: plan.budgetTarget, href: '#step-3' });
    if (field === 'budgetMode') { const mode = budgetModes.find(m => m.id === plan.budgetMode); if (mode) out.push({ field, label: 'How firm', value: mode.title.replace(/^I have a /, '').replace(/^I /, ''), href: '#step-3' }); }
    if (field === 'priorities' && plan.priorities.length) out.push({ field, label: 'Matters most', value: plan.priorities.join(', '), href: '#step-0' });
  }
  return out;
}

function DraftValueList({ plan, edit = 'here' }: { plan: WeddingPlan; edit?: 'here' | 'planner' | 'none' }) {
  const values = draftValues(plan);
  if (!values.length) return null;
  return <ul data-testid="ai-draft-values" className="mt-2 grid gap-1">
    {values.map(v => <li key={v.field} className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-charcoal/10 py-2">
      <span className="min-w-0"><span className="text-charcoal/60">{v.label}: </span><span className="font-semibold [overflow-wrap:anywhere]">{v.value}</span></span>
      {edit === 'none' ? null : <a href={edit === 'planner' ? `/free-wedding-planner${v.href}` : v.href} className="no-print inline-flex min-h-11 items-center font-bold text-blue underline underline-offset-4">Edit ✎<span className="sr-only"> {v.label}</span></a>}
    </li>)}
  </ul>;
}

/** `edit`: 'here' on the planner, 'planner' on pages that link back to it, 'none' on the printed plan. */
export function AiDraftLabel({ plan, edit = 'here' }: { plan: WeddingPlan; edit?: 'here' | 'planner' | 'none' }) {
  if (!plan.aiDraft) return null;
  // The rules reader is not AI: never tell the couple it was (click-through, 10 Nov 2026).
  const byAi = plan.aiDraft.byAi !== false;
  return <div data-testid="ai-drafted-label" className="rounded-2xl border border-charcoal/15 bg-white p-4 text-sm leading-6">
    <p className="font-semibold">{byAi ? 'AI-drafted, from your description.' : 'Drafted from your description, without AI.'} Check every line before you rely on it.</p>
    <DraftValueList plan={plan} edit={edit} />
    {plan.aiDraft.notes.length ? <ul className="mt-2 list-disc pl-5 text-charcoal/80">{plan.aiDraft.notes.map(note => <li key={note}>{note}</li>)}</ul> : null}
  </div>;
}

/** The calm waiting state: the free chain usually answers in a few seconds, and can take up to a minute. */
function DraftProgress() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => { const t = window.setInterval(() => setSeconds(s => s + 1), 1000); return () => window.clearInterval(t); }, []);
  return <div role="status" aria-live="polite" data-testid="ai-progress" className="rounded-2xl border border-blue/30 bg-blue-soft p-4 text-sm leading-6">
    <p className="font-semibold">{seconds < 6 ? 'Reading your sentence…' : seconds < 20 ? 'Still working. The first free AI model was busy, so the next one is trying…' : 'Still working. If no free AI model answers, your sentence is read without AI…'}</p>
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white" aria-hidden="true"><div className="h-full w-1/3 animate-[dwb-slide_1.4s_ease-in-out_infinite] rounded-full bg-blue" /></div>
    <p className="mt-2 text-charcoal/70">Usually a few seconds; up to a minute when the free AI is busy. {seconds}s so far. You can keep this page open.</p>
  </div>;
}

export function AiDraftCard({ plan, onApply }: { plan: WeddingPlan; onApply: (next: WeddingPlan) => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [maxLength, setMaxLength] = useState(400);
  const [email, setEmail] = useState('');
  const [knownEmail, setKnownEmail] = useState(false);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<{ kept: string[]; note: string } | null>(null);

  // The card mounts under the email gate (the planner renders, inert, beneath it),
  // so the address the gate saves arrives after mount: read it again on unlock.
  // Live check, 6 Nov 2026: the card asked for the email the couple had just given.
  useEffect(() => {
    const readEmail = () => { try { const saved = localStorage.getItem(BUILDER_EMAIL_KEY); if (saved) { setEmail(saved); setKnownEmail(true); } } catch { /* storage blocked: ask for it */ } };
    readEmail();
    window.addEventListener('dwb-builder-unlocked', readEmail);
    return () => window.removeEventListener('dwb-builder-unlocked', readEmail);
  }, []);

  // aiweddingplannerfree.com lands on #ai-draft, but the card only exists once the
  // server says the step is on, after the browser has already looked for the anchor.
  useEffect(() => {
    if (!enabled || window.location.hash !== '#ai-draft') return;
    const go = () => requestAnimationFrame(() => document.getElementById('ai-draft')?.scrollIntoView({ block: 'start' }));
    let open = false;
    try { open = Boolean(localStorage.getItem(BUILDER_ACCESS_KEY)); } catch { /* fine */ }
    if (open) go();
    window.addEventListener('dwb-builder-unlocked', go);
    return () => window.removeEventListener('dwb-builder-unlocked', go);
  }, [enabled]);

  useEffect(() => {
    fetch('/api/ai-draft', { cache: 'no-store' }).then(r => r.json()).then((d: { enabled?: boolean; maxLength?: number }) => { setEnabled(Boolean(d.enabled)); if (d.maxLength) setMaxLength(d.maxLength); }).catch(() => setEnabled(false));
  }, []);

  const used = plan.aiDraft !== null;
  if (!enabled && !used) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setResult(null);
    // Our own words for every refusal, shown in the card: a disabled button explains nothing.
    if (description.trim().length < MIN_LENGTH) { setMessage(`Tell us a little more (at least ${MIN_LENGTH} characters), for example the month, the place and roughly how many guests.`); return; }
    if (!email.trim()) { setMessage('Enter the email you opened the planner with.'); return; }
    if (!consent) { setMessage('Tick the box first: nothing is sent until you do.'); return; }
    setMessage(''); setBusy(true);
    try {
      const res = await fetch('/api/ai-draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, description, consent }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; draft?: AiDraftFields; note?: string; filledBy?: string };
      if (!res.ok || !data.ok || !data.draft) { setMessage(data.error ?? 'AI drafting is busy. Please try again later; you can still build your plan by hand below.'); return; }
      const applied = applyAiDraft(plan, data.draft, description.trim(), new Date().toISOString(), data.filledBy !== 'rules');
      onApply(applied.plan);
      setResult({ kept: applied.kept, note: data.note ?? '' });
      try { localStorage.setItem(BUILDER_EMAIL_KEY, email.trim().toLowerCase()); } catch { /* fine */ }
    } catch {
      setMessage('AI drafting is busy. Please try again later; you can still build your plan by hand below.');
    } finally { setBusy(false); }
  }

  // Once the one free draft is used the card is a short receipt: what was read, where
  // to change it, and the same sentence the server gives on any other device.
  if (used) return <section id="ai-draft" data-testid="ai-draft-card" data-state="used" className="scroll-mt-24 rounded-[12px] border border-charcoal/15 bg-white p-5 md:p-7">
    <p className="text-xs font-bold uppercase tracking-[.12em] text-charcoal/60">Your free AI draft · used ✓</p>
    {result ? <div role="status" data-testid="ai-result" className="mt-2 text-sm leading-6">
      <p className="font-serif text-2xl">Here is what we read.</p>
      <DraftValueList plan={plan} />
      {result.kept.length ? <p className="mt-2 text-charcoal/70">Your own answers were kept where you had already filled them in.</p> : null}
      {result.note ? <p className="mt-2 text-charcoal/70">{result.note}</p> : null}
      <p className="mt-2"><a href="#your-date" className="inline-flex min-h-11 items-center font-bold text-blue underline underline-offset-4">See your dated plan ▾</a></p>
    </div> : null}
    <p data-testid="ai-used-message" className="mt-2 text-sm leading-6 text-charcoal/75">{AI_DRAFT_USED_TEXT}</p>
  </section>;

  return <section id="ai-draft" data-testid="ai-draft-card" data-state="ready" className="scroll-mt-24 rounded-[12px] border border-charcoal/15 bg-white p-5 md:p-7">
    <p className="text-xs font-bold uppercase tracking-[.12em] text-charcoal/60">AI draft · free, once per email</p>
    <h2 className="mt-2 font-serif text-3xl">Describe your wedding in a sentence.</h2>
    <p className="mt-2 text-sm leading-6 text-charcoal/70">An AI drafts your dated plan from it; then you edit everything by hand. Leave out names and anything private.</p>
    <form onSubmit={submit} noValidate className="mt-4 grid gap-3">
      <label className="grid gap-2 text-sm font-semibold" htmlFor="ai-description">Your wedding, in your words
        <textarea id="ai-description" data-testid="ai-description" value={description} onChange={e => setDescription(e.target.value)} maxLength={maxLength} disabled={busy} placeholder="200 guests, June in Memphis, small budget, outdoor if the weather allows" className="min-h-24 rounded-2xl border border-charcoal/20 p-3 text-base font-normal" />
      </label>
      <p className="text-xs text-charcoal/60">{description.length} of {maxLength} characters</p>
      {knownEmail ? null : <label className="grid gap-2 text-sm font-semibold" htmlFor="ai-email">The email you opened the planner with
        <input id="ai-email" data-testid="ai-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="min-h-11 rounded-2xl border border-charcoal/20 px-3 text-base font-normal" />
      </label>}
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-6" htmlFor="ai-consent">
        <input id="ai-consent" data-testid="ai-consent" type="checkbox" checked={consent} onChange={e => { setConsent(e.target.checked); if (e.target.checked) setMessage(''); }} className="mt-0.5 h-6 w-6 shrink-0 accent-blue" />
        <span>{AI_CONSENT_TEXT}</span>
      </label>
      {message ? <p role="alert" data-testid="ai-message" className="rounded-2xl bg-ivory p-3 text-sm leading-6">{message}</p> : null}
      {busy ? <DraftProgress /> : <button data-testid="ai-submit" type="submit" className="min-h-12 rounded-2xl bg-blue px-6 py-3 font-bold text-white">Draft my plan with AI ›</button>}
      <p className="text-sm text-charcoal/70">Rather not? <a href="#your-date" className="font-bold text-blue underline underline-offset-4">Start with your date ▾</a></p>
    </form>
  </section>;
}
