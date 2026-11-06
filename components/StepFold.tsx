'use client';
import { useEffect, useState, type ReactNode } from 'react';

// Collapsible Builder steps (preview, 6 Nov 2026). The planner was about 40 phone
// screens tall; every step's heading stays on the page and its fields stay in the
// DOM, but a closed step shows only its heading and an Open button. Nothing is
// removed and nothing about saving changes: fields keep their values while closed.
// A step opens when: it is open by default, the reader taps it, a link or the
// email gate lands on its #id (or on anything inside it), or "Open all steps".
export const STEP_FOLD_EVENT = 'dwb-steps';

export function StepFold({ id, header, children, defaultOpen = false, className = 'grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[220px_minmax(0,1fr)]', label = 'step' }: { id: string; header: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string; label?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    const fromHash = () => {
      const target = decodeURIComponent(window.location.hash.slice(1));
      if (!target) return;
      const section = document.getElementById(id);
      const el = document.getElementById(target);
      if (section && el && (el === section || section.contains(el))) {
        setOpen(true);
        requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }));
      }
    };
    // A second tap on the same #step link fires no hashchange, so clicks are read too.
    const onClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement | null)?.closest?.('a[href*="#"]') as HTMLAnchorElement | null;
      if (link && link.hash === `#${id}`) setOpen(true);
    };
    const onAll = (event: Event) => setOpen(Boolean((event as CustomEvent<boolean>).detail));
    fromHash();
    window.addEventListener('hashchange', fromHash);
    document.addEventListener('click', onClick);
    window.addEventListener(STEP_FOLD_EVENT, onAll);
    return () => { window.removeEventListener('hashchange', fromHash); document.removeEventListener('click', onClick); window.removeEventListener(STEP_FOLD_EVENT, onAll); };
  }, [id]);
  const bodyId = `${id}-body`;
  return <section id={id} data-fold={open ? 'open' : 'closed'} className={`${className} scroll-mt-24`}>
    <div className="min-w-0">
      {header}
      <button type="button" data-testid={`fold-toggle-${id}`} aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((v) => !v)}
        className={`no-print mt-3 inline-flex min-h-11 items-center gap-2 rounded-2xl border-[1.5px] px-4 text-sm font-bold ${open ? 'border-charcoal/20 bg-white text-charcoal' : 'border-blue bg-blue-soft text-charcoal'}`}>
        {open ? `Close this ${label}` : `Open this ${label}`}<span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
    </div>
    <div id={bodyId} data-fold-body hidden={!open} className="min-w-0">{children}</div>
  </section>;
}

export function StepFoldAll() {
  const set = (open: boolean) => window.dispatchEvent(new CustomEvent(STEP_FOLD_EVENT, { detail: open }));
  return <div className="no-print mt-3 flex flex-wrap gap-2">
    <button type="button" data-testid="fold-open-all" onClick={() => set(true)} className="inline-flex min-h-11 items-center rounded-2xl border border-charcoal/20 bg-white px-4 text-sm font-bold">Open all steps</button>
    <button type="button" data-testid="fold-close-all" onClick={() => set(false)} className="inline-flex min-h-11 items-center rounded-2xl border border-charcoal/20 bg-white px-4 text-sm font-bold">Close all steps</button>
  </div>;
}
