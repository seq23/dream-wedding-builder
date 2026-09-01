'use client';

// The scroll-triggered planner pill.
//
// Guides are long. A reader who arrived from search is here for the answer, so
// the pill does not exist until they are ~40% of the way down - past the point
// where an interruption would be the first thing they experience. It is small,
// corner-anchored, and dismissible, because the citation goal and the conversion
// goal disagree and the citation goal wins: a full-width sticky bar or an
// interstitial converts marginally better and is an intrusive-interstitial signal
// on mobile, on exactly the pages we want quoted as a reference.
//
// prefers-reduced-motion removes the entrance animation. It does NOT remove the
// pill - hiding a navigation affordance from people who asked for less motion
// would be denying them the link, not respecting the preference.
//
// Dismissal is remembered in localStorage. Somebody who said no is not asked
// again on the next page; that is the whole point of storing it.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PLANNER_PILL_DISMISS_KEY, PLANNER_ROUTE, plannerHref, type PlannerSeed } from '@/lib/planner-seed';

export { PLANNER_PILL_DISMISS_KEY };

/** Routes where the pill is never shown. Reasons, not a habit: */
export const PLANNER_PILL_SUPPRESSED_PREFIXES = [
  PLANNER_ROUTE,      // already there
  '/products',        // a purchase decision in progress
  '/shop',            // a purchase decision in progress
  '/order',           // checkout and post-checkout
  '/pack',            // output of the planner, print surface
  '/dashboard',       // output of the planner
  '/admin'            // not a reader surface at all
];

export function isPlannerPillSuppressed(pathname: string): boolean {
  return PLANNER_PILL_SUPPRESSED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

type CtaConfig = { label: string; seed: PlannerSeed };
const defaultConfig: CtaConfig = { label: 'Build your plan free →', seed: {} };
const PlannerCtaContext = createContext<{ config: CtaConfig; setConfig: (config: CtaConfig) => void }>({ config: defaultConfig, setConfig: () => {} });

/**
 * Pages that own a constraint declare it, so the pill reads "Build your 12-month
 * plan" rather than a generic label, and the planner opens already carrying that
 * page's seed. Renders nothing itself.
 */
export function PlannerCta({ label, seed }: { label: string; seed: PlannerSeed }) {
  const { setConfig } = useContext(PlannerCtaContext);
  const key = JSON.stringify(seed);
  useEffect(() => { setConfig({ label, seed }); }, [label, key, setConfig]);
  return null;
}

export function PlannerCtaProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<CtaConfig>(defaultConfig);
  const value = useMemo(() => ({ config, setConfig }), [config]);
  return <PlannerCtaContext.Provider value={value}>{children}<PlannerPill /></PlannerCtaContext.Provider>;
}

function PlannerPill() {
  const pathname = usePathname() ?? '/';
  const { config } = useContext(PlannerCtaContext);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(true); // assume dismissed until storage is read, so it never flashes
  const suppressed = isPlannerPillSuppressed(pathname);

  useEffect(() => {
    if (suppressed) return;
    try { setDismissed(localStorage.getItem(PLANNER_PILL_DISMISS_KEY) === '1'); }
    catch { setDismissed(false); } // storage blocked is not a reason to hide a link
  }, [suppressed, pathname]);

  useEffect(() => {
    if (suppressed || dismissed) return;
    const check = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      // A page too short to scroll has no "40% down" - show it rather than never.
      const depth = scrollable <= 0 ? 1 : window.scrollY / scrollable;
      if (depth >= 0.4) setVisible(true);
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => { window.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
  }, [suppressed, dismissed, pathname]);

  useEffect(() => { setVisible(false); }, [pathname]);

  if (suppressed || dismissed || !visible) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(PLANNER_PILL_DISMISS_KEY, '1'); } catch { /* a dismissal that cannot be stored still hides it for this page */ }
  };

  return <div data-testid="planner-pill" className="no-print fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 motion-safe:animate-[fadeIn_.2s_ease-out] md:inset-x-auto md:right-6 md:justify-end">
    <div role="complementary" aria-label="Free wedding planner" className="flex max-w-[22rem] items-center gap-2 rounded-full border border-charcoal/15 bg-white/95 py-2 pl-4 pr-2 shadow-soft backdrop-blur">
      <Link data-testid="planner-pill-link" href={plannerHref(config.seed)} className="text-sm font-bold leading-5 underline-offset-4 hover:underline">{config.label}</Link>
      <button data-testid="planner-pill-dismiss" type="button" onClick={dismiss} aria-label="Dismiss the free wedding planner prompt" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-charcoal/10 text-lg leading-none text-charcoal/60 hover:bg-linen">×</button>
    </div>
  </div>;
}
