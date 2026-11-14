'use client';

import { useEffect, useRef, useState } from 'react';
import { BUDGETS, LOVES, MOODS, SEASONS, SETTINGS, TRADITIONS, type WeddingRead } from '@/lib/wedding-read-shared';
import { JOURNEY_EVENT, JOURNEY_KEY, pickable, type JourneyPick } from '@/lib/journey-picks';
import { undatedPlan } from '@/lib/dated-plan';

// The free journey's steps 1 and 2 (approved sample, 13 Nov 2026): what should your
// wedding feel like, then your wedding described. No account and no email. Photos are
// read for colours on this phone; a photo leaves it only when she ticks "Let the AI
// planner look at this photo", shrunk first, and is never stored by us. Everything
// the server returns is rendered as plain React text, never as HTML.

const STEPS = ['Tell us', 'See it', 'Keep', 'Plan'];
const PHOTO_SIDE = 640;

type Path = 'idea' | 'dk' | null;
interface PhotoState { id: string; url: string; colours: string[]; loves: string[]; allowAi: boolean; file: File }
interface Facts { where: string; guests: string; budget: string; tradition: string; venueBooked: boolean; dateSet: boolean }
interface Answer { read: WeddingRead; remaining: number | null; limit: number; reason: string }
export interface JourneyFacts { where: string; guests: string; budget: string }

function readSaved(): { path: Path; wish: string; season: string; setting: string; moods: string[]; facts: Facts; answer: Answer | null; picks?: JourneyPick[] } | null {
  try { const raw = localStorage.getItem(JOURNEY_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

/** The five strongest colours in a photo, worked out in this browser. Nothing is sent. */
function photoColours(img: HTMLImageElement): string[] {
  const c = document.createElement('canvas');
  const w = (c.width = 48), h = (c.height = 48);
  const x = c.getContext('2d');
  if (!x) return [];
  x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  const bins: Record<string, { n: number; r: number; g: number; b: number }> = {};
  for (let i = 0; i < d.length; i += 4) {
    const k = `${d[i] >> 5},${d[i + 1] >> 5},${d[i + 2] >> 5}`;
    const o = (bins[k] ??= { n: 0, r: 0, g: 0, b: 0 });
    o.n++; o.r += d[i]; o.g += d[i + 1]; o.b += d[i + 2];
  }
  return Object.values(bins).sort((a, b) => b.n - a.n).slice(0, 5).map(o => '#' + [o.r, o.g, o.b].map(v => Math.round(v / o.n).toString(16).padStart(2, '0')).join(''));
}

const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = url; });

/** Shrinks a photo on this phone before it may be sent (about 640 px, JPEG). */
async function shrink(url: string): Promise<string> {
  const img = await loadImage(url);
  const scale = Math.min(1, PHOTO_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.72).replace(/^data:image\/jpeg;base64,/, '');
}

function Chip({ on, onClick, children, testId }: { on: boolean; onClick: () => void; children: React.ReactNode; testId?: string }) {
  return <button type="button" data-testid={testId} aria-pressed={on} onClick={onClick} className={`min-h-11 rounded-full border bg-white px-4 py-2 text-sm font-medium ${on ? 'border-blue shadow-[inset_0_0_0_1px_#2747D9]' : 'border-rule'}`}>{children}</button>;
}

function Swatches({ colours }: { colours: { name?: string; hex: string }[] }) {
  return <div className="flex flex-wrap gap-x-3 gap-y-2">{colours.map((c, i) => <span key={`${c.hex}-${i}`} className="inline-flex items-center gap-1.5 text-sm"><i aria-hidden className="inline-block h-[22px] w-[22px] rounded-full border border-rule" style={{ background: c.hex }} />{c.name}</span>)}</div>;
}

const MONO = 'font-mono text-xs uppercase tracking-[.08em] text-midnight-muted';
const INPUT = 'min-h-11 w-full rounded-xl border border-rule bg-white p-3 text-base';

const REACH_KEY = 'dwb-blend-reach';
/** Counts, once a day per browser, that a bride who began at step 1 reached her plan (the scorecard's result). */
function countReach(via: 'date' | 'no_date') {
  try { const day = new Date().toISOString().slice(0, 10); if (localStorage.getItem(REACH_KEY) === day) return; localStorage.setItem(REACH_KEY, day); } catch { /* still count */ }
  void fetch('/api/journey-reach', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ via }), keepalive: true }).catch(() => undefined);
}

function PickButton({ on, label, sub, onClick }: { on: boolean; label: string; sub: string; onClick: () => void }) {
  return <button type="button" data-testid="journey-pick" aria-pressed={on} onClick={onClick} className={`flex w-full flex-col gap-1 rounded-xl border bg-white p-3 text-left ${on ? 'border-blue shadow-[inset_0_0_0_1px_#2747D9]' : 'border-rule'}`}>
    {label ? <b className="font-semibold">{label}</b> : null}<span className="text-[.94rem]">{sub}</span>
    {on ? <span className="font-mono text-[.72rem] uppercase tracking-[.06em] text-done">✓ Kept</span> : null}
  </button>;
}

export function WeddingJourney({ onFacts, weddingDate = '', onDate, onPlan }: { onFacts?: (facts: JourneyFacts) => void; weddingDate?: string; onDate?: (date: string) => void; onPlan?: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [picks, setPicks] = useState<JourneyPick[]>([]);
  const [noDate, setNoDate] = useState(false);
  const [path, setPath] = useState<Path>(null);
  const [wish, setWish] = useState('');
  const [season, setSeason] = useState('');
  const [setting, setSetting] = useState('');
  const [moods, setMoods] = useState<string[]>([]);
  const [photos, setPhotos] = useState<PhotoState[]>([]);
  const [facts, setFacts] = useState<Facts>({ where: '', guests: '', budget: '', tradition: '', venueBooked: false, dateSet: false });
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const top = useRef<HTMLElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    const saved = readSaved();
    if (saved) {
      setPath(saved.path ?? null); setWish(saved.wish ?? ''); setSeason(saved.season ?? ''); setSetting(saved.setting ?? ''); setMoods(Array.isArray(saved.moods) ? saved.moods : []);
      if (saved.facts) setFacts(f => ({ ...f, ...saved.facts }));
      if (Array.isArray(saved.picks)) setPicks(saved.picks);
      if (saved.answer?.read) { setAnswer(saved.answer); setStep(2); }
    }
    // The home page's fork cards open the planner on that fork (#feel-idea, #feel-dk).
    const fork = window.location.hash === '#feel-idea' ? 'idea' : window.location.hash === '#feel-dk' ? 'dk' : null;
    if (fork) { setPath(fork); setStep(1); requestAnimationFrame(() => top.current?.scrollIntoView({ block: 'start' })); }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(JOURNEY_KEY, JSON.stringify({ path, wish, season, setting, moods, facts, answer, picks })); } catch { /* a private window: the journey still works, it just is not kept */ }
    window.dispatchEvent(new Event(JOURNEY_EVENT));
  }, [path, wish, season, setting, moods, facts, answer, picks]);

  const addPhoto = async (file: File | undefined) => {
    if (!file || photos.length >= 3 || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      setPhotos(list => list.length >= 3 ? list : [...list, { id: `${Date.now()}-${list.length}`, url, colours: photoColours(img), loves: [], allowAi: false, file }]);
    } catch { URL.revokeObjectURL(url); setProblem('That photo could not be opened. Try a JPEG or PNG.'); }
  };
  const updatePhoto = (id: string, change: Partial<PhotoState>) => setPhotos(list => list.map(p => (p.id === id ? { ...p, ...change } : p)));

  const go = async () => {
    if (!path) return;
    if (path === 'idea' && wish.trim().length < 3 && !photos.length) { setProblem('Say it in a few words, add a photo, or tap “I don’t know yet”.'); return; }
    setBusy(true); setProblem('');
    onFacts?.({ where: facts.where.trim(), guests: facts.guests.trim(), budget: facts.budget });
    try {
      const sentPhotos = await Promise.all(photos.map(async p => ({ loves: p.loves, colours: p.colours, ...(p.allowAi ? { image: await shrink(p.url) } : {}) })));
      const res = await fetch('/api/wedding-read', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path, wish, season, setting, moods, photos: sentPhotos, facts }) });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) { setProblem(body?.error ?? 'That did not go through. Please try again.'); return; }
      setAnswer({ read: body.read, remaining: body.remaining, limit: body.limit, reason: body.reason });
      setPicks([]);
      setStep(2);
      requestAnimationFrame(() => top.current?.scrollIntoView({ block: 'start' }));
    } catch {
      setProblem('No connection just now. Your answers are kept; try again in a moment.');
    } finally { setBusy(false); }
  };

  const read = answer?.read;
  const toPlan = () => { onPlan?.(); window.setTimeout(() => document.getElementById('your-date')?.scrollIntoView({ block: 'start' }), 60); };
  const goTo = (n: 1 | 2 | 3 | 4) => { setStep(n); requestAnimationFrame(() => top.current?.scrollIntoView({ block: 'start' })); };
  const togglePick = (p: JourneyPick) => setPicks(list => list.some(x => x.key === p.key) ? list.filter(x => x.key !== p.key) : [...list, p]);
  const chooseDate = (date: string) => { onDate?.(date); setNoDate(false); if (date) onPlan?.(); if (date && answer) countReach('date'); };
  const chooseNoDate = () => { setNoDate(true); onPlan?.(); if (answer) countReach('no_date'); };
  const groups = read ? pickable(read, facts.venueBooked) : null;
  const photoSwatches = photos.flatMap(p => p.colours).slice(0, 8).map(hex => ({ hex }));

  return <section id="ai-draft" ref={top} data-testid="journey" data-step={step} className="scroll-mt-24 grid gap-5">
    <div aria-hidden className="grid gap-1.5">
      <div className="flex gap-1.5">{STEPS.map((s, i) => <i key={s} className={`h-1 flex-1 rounded ${i < step ? 'bg-blue' : 'bg-rule'}`} />)}</div>
      <div className="flex gap-1.5">{STEPS.map(s => <span key={s} className={`${MONO} flex-1 text-[.62rem]`}>{s}</span>)}</div>
    </div>

    {step === 1 && <div className="grid gap-5" data-testid="journey-step-1">
      <div>
        <h1 className="font-serif text-[2.05rem] leading-[1.12] md:text-5xl">What should your wedding feel like?</h1>
        <p className="mt-2">Free, with no account and no email.</p>
      </div>
      <div role="radiogroup" aria-label="Do you know what you want?" className="grid grid-cols-2 gap-2.5">
        {([['idea', 'I have an idea', 'Say it in your own words'], ['dk', 'I don’t know yet', 'Tap a few things you like']] as const).map(([id, title, sub]) => <button key={id} type="button" role="radio" aria-checked={path === id} data-testid={`fork-${id}`} onClick={() => setPath(id)} className={`flex min-w-0 flex-col gap-1 rounded-xl border-[1.5px] bg-white p-3.5 text-left ${path === id ? 'border-blue shadow-[inset_0_0_0_1.5px_#2747D9]' : 'border-rule'}`}>
          <span aria-hidden className={`mb-1 h-[18px] w-[18px] rounded-full border-midnight-muted ${path === id ? 'border-[6px] border-blue' : 'border-[1.5px]'}`} />
          <b className="font-semibold">{title}</b><span className="text-sm text-midnight-muted">{sub}</span>
        </button>)}
      </div>

      {path === 'idea' && <textarea data-testid="journey-wish" aria-label="Your wedding in your own words" value={wish} maxLength={400} onChange={e => setWish(e.target.value)} placeholder="For example: an Italian villa feel, candlelit long tables, 100 people" className={`${INPUT} min-h-24`} />}

      {path === 'dk' && <div className="grid gap-4" data-testid="journey-picks">
        <div className="grid gap-2"><p className={MONO}>When</p><div className="flex flex-wrap gap-2">{SEASONS.map(s => <Chip key={s} testId={`season-${s}`} on={season === s} onClick={() => setSeason(season === s ? '' : s)}>{s}</Chip>)}</div></div>
        <div className="grid gap-2"><p className={MONO}>Where</p><div className="flex flex-wrap gap-2">{SETTINGS.map(s => <Chip key={s} testId={`setting-${s}`} on={setting === s} onClick={() => setSetting(setting === s ? '' : s)}>{s}</Chip>)}</div></div>
        <div className="grid gap-2"><p className={MONO}>How it should feel (pick any)</p><div className="flex flex-wrap gap-2">{MOODS.map(m => <Chip key={m} testId={`mood-${m}`} on={moods.includes(m)} onClick={() => setMoods(list => list.includes(m) ? list.filter(x => x !== m) : [...list, m])}>{m}</Chip>)}</div></div>
      </div>}

      {path && <div className="grid gap-2" data-testid="journey-photos">
        <p className={MONO}>Photos you love (optional, up to 3)</p>
        {photos.map((p, i) => <div key={p.id} data-testid="journey-photo" className="flex items-start gap-2.5 rounded-xl border border-rule bg-white p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, never uploaded */}
          <img alt={`Your photo ${i + 1}`} src={p.url} className="h-[72px] w-[72px] flex-none rounded-lg object-cover" />
          <div className="grid min-w-0 gap-2">
            <span className="text-sm text-midnight-muted">What do you love in it?</span>
            <div className="flex flex-wrap gap-1.5">{LOVES.map(l => <Chip key={l} on={p.loves.includes(l)} onClick={() => updatePhoto(p.id, { loves: p.loves.includes(l) ? p.loves.filter(x => x !== l) : [...p.loves, l] })}>{l}</Chip>)}</div>
            <Swatches colours={p.colours.map(hex => ({ hex }))} />
            <span className="text-sm text-midnight-muted">Colours above were read on this phone. Nothing was sent.</span>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" data-testid="photo-allow-ai" className="mt-1" checked={p.allowAi} onChange={e => updatePhoto(p.id, { allowAi: e.target.checked })} /> Let the AI planner look at this photo</label>
            <span className="text-sm text-midnight-muted">The AI provider may use what it is sent to improve its products. A photo without faces is best. We do not keep it.</span>
            <button type="button" className="justify-self-start text-sm underline underline-offset-4" onClick={() => { URL.revokeObjectURL(p.url); setPhotos(list => list.filter(x => x.id !== p.id)); }}>Remove this photo</button>
          </div>
        </div>)}
        {photos.length < 3 && <label className="inline-flex min-h-11 cursor-pointer items-center font-medium underline underline-offset-4">Add a photo ›<input data-testid="journey-photo-input" type="file" accept="image/*" className="sr-only" onChange={e => { void addPhoto(e.target.files?.[0]); e.target.value = ''; }} /></label>}
      </div>}

      {path && <details data-testid="journey-facts" className="rounded-xl border border-rule bg-white p-3">
        <summary className="min-h-11 cursor-pointer content-center font-medium">If you already know some things</summary>
        <div className="mt-2 grid gap-2.5">
          <input data-testid="fact-where" type="text" aria-label="Town or city" placeholder="Town or city" value={facts.where} maxLength={60} onChange={e => setFacts({ ...facts, where: e.target.value })} className={INPUT} />
          <input data-testid="fact-guests" type="number" inputMode="numeric" aria-label="Guests" placeholder="About how many guests" min={2} value={facts.guests} onChange={e => setFacts({ ...facts, guests: e.target.value })} className={INPUT} />
          <select aria-label="Budget" data-testid="fact-budget" value={facts.budget} onChange={e => setFacts({ ...facts, budget: e.target.value })} className={INPUT}><option value="">Budget (optional)</option>{BUDGETS.map(b => <option key={b}>{b}</option>)}</select>
          <select aria-label="Tradition" data-testid="fact-tradition" value={facts.tradition} onChange={e => setFacts({ ...facts, tradition: e.target.value })} className={INPUT}><option value="">Tradition (optional)</option>{TRADITIONS.map(t => <option key={t}>{t}</option>)}</select>
          <p className={MONO}>Already decided</p>
          <label className="flex items-start gap-2"><input type="checkbox" data-testid="fact-venue-booked" className="mt-1" checked={facts.venueBooked} onChange={e => setFacts({ ...facts, venueBooked: e.target.checked })} /> The venue is booked</label>
          <label className="flex items-start gap-2"><input type="checkbox" data-testid="fact-date-set" className="mt-1" checked={facts.dateSet} onChange={e => setFacts({ ...facts, dateSet: e.target.checked })} /> The date is set</label>
        </div>
      </details>}

      {path && <p className="text-sm text-midnight-muted">What you tell us goes to a free AI model (Google Gemini or OpenRouter), which may use it to improve its products. Leave out names.</p>}
      {problem && <p role="alert" className="text-sm font-semibold text-red-pen">{problem}</p>}
      <button type="button" data-testid="journey-continue" disabled={!path || busy} onClick={go} className="min-h-12 w-full rounded-xl bg-blue px-4 py-3.5 text-[1.05rem] font-semibold text-white disabled:opacity-40">{busy ? 'Reading your wedding…' : 'Continue · step 1 of 4 ›'}</button>
      <p aria-live="polite" className="sr-only">{busy ? 'Reading your wedding. This takes a few seconds.' : ''}</p>
      <a href="#your-date" data-testid="journey-skip" className="min-h-11 font-medium underline underline-offset-4">I already know what I want. Just give me my plan ›</a>
    </div>}

    {step === 2 && read && <div className="grid gap-5" data-testid="journey-step-2" data-by={read.by}>
      <p className={MONO}>Your wedding, described</p>
      <h1 data-testid="read-headline" className="font-serif text-[2.05rem] leading-[1.12] md:text-5xl">{read.headline}</h1>
      <p data-testid="read-text">{read.read}</p>
      {read.photoNotes.length > 0 && <div className="grid gap-1">{read.photoNotes.map((n, i) => <p key={i} className="text-sm"><b>From your photo:</b> {n}</p>)}</div>}
      <div className="grid gap-2"><p className={MONO}>Your colours</p><Swatches colours={read.colours} />
        {photoSwatches.length > 0 && <><p className={`${MONO} mt-2`}>From your photos, read on this phone</p><Swatches colours={photoSwatches} /></>}</div>
      <h2 className="font-serif text-2xl">Two directions</h2>
      <div className="grid gap-2">{read.directions.map(d => <div key={d.name} className="rounded-xl border border-rule bg-white p-3"><b>{d.name}</b><br />{d.what}</div>)}</div>
      {facts.venueBooked ? <p data-testid="read-venue-booked" className="rounded-xl border border-rule bg-white p-3">You said your venue is booked, so no venue types are suggested.</p>
        : read.venueTypes.length > 0 && <div data-testid="read-venues"><h2 className="font-serif text-2xl">{facts.where.trim() ? 'Places near you that carry this feel' : 'Kinds of place that carry this feel'}</h2><ul className="mt-2 grid list-disc gap-2 pl-5">{read.venueTypes.map(v => <li key={v.id}><b>{v.name}.</b> {v.why}</li>)}</ul><p className="mt-2 text-sm text-midnight-muted">Kinds of place to look for, not named venues.</p></div>}
      {read.ideas.length > 0 && <div data-testid="read-ideas"><h2 className="font-serif text-2xl">Ideas that fit</h2><p className="text-sm text-midnight-muted">Chosen from our 175 standout ideas, from what you told us.</p>
        <ul className="mt-2 grid list-disc gap-2 pl-5">{read.ideas.map(i => <li key={i.id} data-testid={`read-idea-${i.id}`}><b>{i.name}</b> <span className="font-mono text-[.68rem] uppercase tracking-[.05em] text-midnight-muted">{i.cost}</span><br />{i.why}</li>)}</ul></div>}
      {read.ask.length > 0 && <div><h2 className="font-serif text-2xl">What to ask</h2><ul className="mt-2 grid list-disc gap-2 pl-5">{read.ask.map(q => <li key={q}>{q}</li>)}</ul></div>}
      {read.honest && <div className="rounded-xl border border-rule bg-white p-3"><b>Worth knowing.</b> {read.honest}</div>}
      <p data-testid="read-label" className="text-sm text-midnight-muted">{read.by === 'ai'
        ? 'Written by an AI planner, not a person. Check anything that matters with your vendors. No businesses, prices or availability are named.'
        : answer?.reason === 'visitor_limit'
          ? 'You have used today’s three AI answers, so this one comes from our fixed lists, without AI. More tomorrow.'
          : 'The free AI planner could not answer just now, so this comes from our fixed lists, without AI.'}</p>
      <button type="button" data-testid="journey-continue-2" onClick={() => goTo(3)} className="min-h-12 w-full rounded-xl bg-blue px-4 py-3.5 text-[1.05rem] font-semibold text-white">Continue · step 2 of 4 ›</button>
      <button type="button" data-testid="journey-change" onClick={() => goTo(1)} className="min-h-11 justify-self-start font-medium underline underline-offset-4">‹ Change my answers{typeof answer?.remaining === 'number' ? ` (${answer.remaining} of ${answer.limit} left today)` : ''}</button>
    </div>}

    {step === 3 && read && groups && <div className="grid gap-5" data-testid="journey-step-3">
      <p className={MONO}>Keep what you love</p>
      <h1 className="font-serif text-[2.05rem] leading-[1.12] md:text-5xl">Tap what belongs in your wedding.</h1>
      {([['The direction', groups.directions], ['The kind of place', groups.venues], ['The ideas', groups.ideas], ['The details', groups.details]] as const).map(([title, items]) => items.length > 0 && <div key={title} className="grid gap-2">
        <h2 className="font-serif text-2xl">{title}</h2>
        {items.map(item => <PickButton key={item.pick.key} on={picks.some(p => p.key === item.pick.key)} label={item.label} sub={item.sub} onClick={() => togglePick(item.pick)} />)}
      </div>)}
      <p className="text-sm text-midnight-muted">Each one you keep becomes a dated task in your plan, marked “Your pick”.{facts.venueBooked ? ' Your venue is booked, so the venue task comes off your plan.' : ''}</p>
      <button type="button" data-testid="journey-continue-3" onClick={() => goTo(4)} className="min-h-12 w-full rounded-xl bg-blue px-4 py-3.5 text-[1.05rem] font-semibold text-white">Continue · step 3 of 4 ›</button>
      <button type="button" onClick={() => goTo(2)} className="min-h-11 justify-self-start font-medium underline underline-offset-4">‹ Back to my wedding</button>
    </div>}

    {step === 4 && read && <div className="grid gap-5" data-testid="journey-step-4">
      <p className={MONO}>Your dated plan</p>
      <h1 className="font-serif text-[2.05rem] leading-[1.12] md:text-5xl">When is it?</h1>
      <label className="grid gap-2 font-medium" htmlFor="journey-date">Wedding date
        <input id="journey-date" data-testid="journey-date" type="date" value={weddingDate} onChange={e => chooseDate(e.target.value)} className={`${INPUT} max-w-xs`} />
      </label>
      {!weddingDate && <button type="button" data-testid="journey-no-date" onClick={chooseNoDate} className="min-h-11 justify-self-start font-medium underline underline-offset-4">I don’t have a date yet ›</button>}
      {weddingDate ? <div className="grid gap-3" data-testid="journey-dated">
        <h2 className="font-serif text-2xl">{picks.length ? `Your plan, with ${picks.length} of your picks in it` : 'Your plan'}</h2>
        <p>Every task is placed on your calendar below{picks.length ? ', with your picks marked “Your pick”' : ''}. It saves in this browser by itself.</p>
        <button type="button" data-testid="journey-to-plan" onClick={toPlan} className="min-h-12 w-full rounded-xl bg-blue px-4 py-3.5 text-[1.05rem] font-semibold text-white">See my dated plan ›</button>
      </div> : noDate ? <div className="grid gap-3" data-testid="journey-undated">
        <h2 className="font-serif text-2xl">{picks.length ? `Your plan, with ${picks.length} of your picks in it` : 'Your plan'}</h2>
        <p className="text-sm text-midnight-muted">Without a date, each task shows how long before the wedding it usually happens. Add the date any time to see real dates.</p>
        {undatedPlan({ picks, venueBooked: facts.venueBooked }).map(w => <div key={w.id} className="rounded-xl border border-rule bg-white p-3">
          <h3 className="font-semibold">{w.label}</h3>
          <ul className="mt-1 grid gap-1.5">{w.tasks.map(t => <li key={t} className="text-sm leading-6">○ {t}{picks.some(p => p.text === t) ? <span className="ml-2 font-mono text-[.68rem] uppercase tracking-[.05em] text-blue">Your pick</span> : null}</li>)}</ul>
        </div>)}
      </div> : null}
      {(weddingDate || noDate) && <div className="grid gap-2 rounded-xl border border-rule bg-white p-3" data-testid="journey-email-offer">
        <p><b>Want it on paper, or a copy for your inbox?</b> The printable page asks for your email once, and only for that.</p>
        <a href="/pack" data-testid="journey-printable" className="min-h-11 content-center font-medium underline underline-offset-4">Open my printable plan ›</a>
      </div>}
      <button type="button" onClick={() => goTo(3)} className="min-h-11 justify-self-start font-medium underline underline-offset-4">‹ Change what I kept</button>
    </div>}
  </section>;
}
