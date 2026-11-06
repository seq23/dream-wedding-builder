'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { BUILDER_ACCESS_KEY, BUILDER_EMAIL_KEY } from '@/lib/builder-signup';
import type { AiDraftFields } from '@/lib/ai-draft';
import type { WeddingPlan } from '@/data/planning';

// "Describe your wedding" -> an AI-drafted plan the couple then edits by hand.
// Shown only when the server says the step is on (kill switch, lib/ai-draft.ts).
// Everything the model returns is rendered as plain React text, never as HTML.

const FIELD_LABELS: Record<string, string> = {
  weddingDate: 'wedding date', guestCount: 'guest count', locations: 'location', season: 'season',
  budgetTarget: 'budget', budgetMode: 'budget style', priorities: 'top priorities'
};

/** Fills only fields the couple has left empty: an AI draft never overwrites their own work. */
export function applyAiDraft(plan: WeddingPlan, draft: AiDraftFields, description: string, at: string): { plan: WeddingPlan; filled: string[]; kept: string[] } {
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
  next.aiDraft = { at, description, fields: filled, notes: draft.notes };
  return { plan: next, filled, kept };
}

export function AiDraftLabel({ plan }: { plan: WeddingPlan }) {
  if (!plan.aiDraft) return null;
  const fields = plan.aiDraft.fields.map(f => FIELD_LABELS[f] ?? f);
  return <div data-testid="ai-drafted-label" className="rounded-2xl border border-charcoal/15 bg-white p-4 text-sm leading-6">
    <p className="font-semibold">AI-drafted, from your description. Check every line before you rely on it.</p>
    {fields.length ? <p className="mt-1 text-charcoal/70">Filled by AI: {fields.join(', ')}. Change any of them below.</p> : null}
    {plan.aiDraft.notes.length ? <ul className="mt-2 list-disc pl-5 text-charcoal/80">{plan.aiDraft.notes.map(note => <li key={note}>{note}</li>)}</ul> : null}
  </div>;
}

export function AiDraftCard({ plan, onApply }: { plan: WeddingPlan; onApply: (next: WeddingPlan) => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [maxLength, setMaxLength] = useState(400);
  const [email, setEmail] = useState('');
  const [knownEmail, setKnownEmail] = useState(false);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<{ filled: string[]; kept: string[] } | null>(null);

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

  if (!enabled) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(''); setResult(null); setBusy(true);
    try {
      const res = await fetch('/api/ai-draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, description }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; draft?: AiDraftFields };
      if (!res.ok || !data.ok || !data.draft) { setMessage(data.error ?? 'AI drafting is busy. Please try again later; you can still build your plan by hand below.'); return; }
      const applied = applyAiDraft(plan, data.draft, description.trim(), new Date().toISOString());
      onApply(applied.plan);
      setResult({ filled: applied.filled, kept: applied.kept });
      try { localStorage.setItem(BUILDER_EMAIL_KEY, email.trim().toLowerCase()); } catch { /* fine */ }
    } catch {
      setMessage('AI drafting is busy. Please try again later; you can still build your plan by hand below.');
    } finally { setBusy(false); }
  }

  return <section id="ai-draft" data-testid="ai-draft-card" className="rounded-[12px] border border-charcoal/15 bg-white p-5 md:p-7">
    <p className="text-xs font-bold uppercase tracking-[.22em] text-charcoal/50">AI draft · free, once per email</p>
    <h2 className="mt-2 font-serif text-3xl">Describe your wedding in a sentence.</h2>
    <p className="mt-2 text-sm leading-6 text-charcoal/70">An AI drafts your dated plan from it; then you edit everything by hand. It is sent to a free AI model, which may keep what you type, so leave out names and anything private.</p>
    <form onSubmit={submit} className="mt-4 grid gap-3">
      <label className="grid gap-2 text-sm font-semibold" htmlFor="ai-description">Your wedding, in your words
        <textarea id="ai-description" data-testid="ai-description" value={description} onChange={e => setDescription(e.target.value)} maxLength={maxLength} required minLength={10} placeholder="200 guests, June in Memphis, small budget, outdoor if the weather allows" className="min-h-24 rounded-2xl border border-charcoal/20 p-3 text-base font-normal" />
      </label>
      <p className="text-xs text-charcoal/55">{description.length} of {maxLength} characters</p>
      {knownEmail ? null : <label className="grid gap-2 text-sm font-semibold" htmlFor="ai-email">The email you opened the planner with
        <input id="ai-email" data-testid="ai-email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="min-h-11 rounded-2xl border border-charcoal/20 px-3 text-base font-normal" />
      </label>}
      {message ? <p role="status" data-testid="ai-message" className="rounded-2xl bg-ivory p-3 text-sm leading-6">{message}</p> : null}
      {result ? <p role="status" data-testid="ai-result" className="rounded-2xl bg-ivory p-3 text-sm leading-6">Drafted. {result.filled.length ? `Filled: ${result.filled.map(f => FIELD_LABELS[f] ?? f).join(', ')}.` : 'Nothing new to fill.'}{result.kept.length ? ` Kept your own answers for: ${result.kept.map(f => FIELD_LABELS[f] ?? f).join(', ')}.` : ''} Your dated plan is below.</p> : null}
      <button data-testid="ai-submit" type="submit" disabled={busy || plan.aiDraft !== null} className="min-h-12 rounded-full bg-charcoal px-6 py-3 font-bold text-linen disabled:opacity-50">{busy ? 'Drafting… (this can take up to a minute)' : plan.aiDraft ? 'Your free AI draft is used ✓' : 'Draft my plan with AI ›'}</button>
    </form>
  </section>;
}
