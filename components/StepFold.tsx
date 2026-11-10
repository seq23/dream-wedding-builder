'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';

// Collapsible planner steps. A closed step shows only its heading and an Open button;
// its fields stay in the DOM and keep their values. A step opens when the reader taps
// it or a link (or the email gate) lands on its #id or on anything inside it.
// Steps that share a `group` open one at a time (hostile review, 10 Nov 2026: the page
// was 50 phone screens with every step open), so opening one closes the others.
export const STEP_OPENED_EVENT = 'dwb-step-opened';

export function StepFold({ id, header, children, defaultOpen = false, className = 'grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[220px_minmax(0,1fr)]', label = 'step', group }: { id: string; header: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string; label?: string; group?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const tapped = useRef(false);
  useEffect(() => {
    const fromHash = () => {
      const target = decodeURIComponent(window.location.hash.slice(1));
      if (!target) return;
      const section = document.getElementById(id);
      const el = document.getElementById(target);
      if (section && el && (el === section || section.contains(el))) {
        setOpen(true);
        const go = () => el.scrollIntoView({ block: 'start' });
        requestAnimationFrame(go);
        // Web fonts swapping in change the height of everything above.
        document.fonts?.ready.then(() => requestAnimationFrame(go)).catch(() => {});
        // And once the first render settles: a seeded link adds a notice above the steps.
        window.setTimeout(go, 400);
      }
    };
    // A second tap on the same #step link fires no hashchange, so clicks are read too.
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest?.('a[href*="#"]') as HTMLAnchorElement | null;
      if (link && link.hash === `#${id}`) setOpen(true);
    };
    const onOther = (event: Event) => { const d = (event as CustomEvent<{ id: string; group?: string }>).detail; if (group && d.group === group && d.id !== id) setOpen(false); };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    document.addEventListener('click', onClick);
    window.addEventListener(STEP_OPENED_EVENT, onOther);
    return () => { window.removeEventListener('hashchange', fromHash); document.removeEventListener('click', onClick); window.removeEventListener(STEP_OPENED_EVENT, onOther); };
  }, [id, group]);
  // Told to the siblings after the render, never from inside a state updater.
  useEffect(() => {
    if (!open || !group) return;
    window.dispatchEvent(new CustomEvent(STEP_OPENED_EVENT, { detail: { id, group } }));
    // A step above this one has just closed, so the page moved: bring the tapped step back to the top.
    if (tapped.current) { tapped.current = false; requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' })); }
  }, [open, id, group]);
  const bodyId = `${id}-body`;
  return <section id={id} data-fold={open ? 'open' : 'closed'} className={`${className} scroll-mt-24`}>
    {/* The toggle sits beside the heading, not under it, so a closed step is one
        short block and a link landing on an open step still shows its first field. */}
    <div className="flex min-w-0 items-start justify-between gap-3 lg:block">
      <div className="min-w-0">{header}</div>
      <button type="button" data-testid={`fold-toggle-${id}`} aria-expanded={open} aria-controls={bodyId} onClick={() => { tapped.current = !open; setOpen(!open); }}
        className={`no-print mt-1 inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap lg:mt-3 rounded-2xl border-[1.5px] px-4 text-sm font-bold ${open ? 'border-charcoal/20 bg-white text-charcoal' : 'border-blue bg-blue-soft text-charcoal'}`}>
        {open ? 'Close' : 'Open'}<span className="sr-only"> {label === 'step' ? 'this step' : `this ${label}`}</span><span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
    </div>
    <div id={bodyId} data-fold-body hidden={!open} className="min-w-0">{children}</div>
  </section>;
}
