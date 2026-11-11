// Every screen in the plan (docs/APP_PLAN.md, section Screens) and how you move between
// them (make-it-calm section 7). The screen shell (src/ui.tsx) and the stack headers
// (src/nav.tsx) read this list, so a screen's Back, Close, Skip and tab bar come from here
// and cannot be forgotten on one screen. test/nav.unit.ts checks the map itself: every
// screen reaches the plan in one tap, every sub-screen has Back inside its own tab, every
// sheet has Close, nothing is orphaned, and the route files match both ways.
export type Kind = 'onboarding' | 'tab' | 'sub' | 'sheet';
export type Tab = 'plan' | 'traditions' | 'two-phones' | 'payments' | 'more';
export interface ScreenSpec {
  route: string; file: string; title: string; kind: Kind;
  /** The tab whose bar stays visible under this screen (not for onboarding). */
  tab?: Tab;
  /** Where Back (and Android back) goes. Tab roots have none. */
  back?: string;
  /** Buttons on the screen, as routes. */
  links: { href: string; label: string }[];
  /** One line on what Codex builds here. */
  coming: string;
}
export const HOME = '/plan';
export const TABS: { tab: Tab; route: string; label: string }[] = [
  { tab: 'plan', route: '/plan', label: 'Plan' },
  { tab: 'traditions', route: '/traditions', label: 'Traditions' },
  { tab: 'two-phones', route: '/two-phones', label: 'Two phones' },
  { tab: 'payments', route: '/payments', label: 'Payments' },
  { tab: 'more', route: '/more', label: '☰ More' },
];
export const SCREENS: ScreenSpec[] = [
  { route: '/more/packet', file: 'app/(tabs)/more/packet.tsx', title: 'Print or send my plan', kind: 'sub', tab: 'more', back: '/more', links: [], coming: 'Not in this build yet.' },
  { route: '/plan/wedding-week', file: 'app/(tabs)/plan/wedding-week.tsx', title: 'Your wedding week', kind: 'sub', tab: 'plan', back: '/plan', links: [], coming: 'Not in this build yet.' },
  { route: '/payments', file: 'app/(tabs)/payments/index.tsx', title: 'Payments', kind: 'tab', tab: 'payments', links: [], coming: 'Not in this build yet.' },
  { route: '/welcome', file: 'app/welcome.tsx', title: 'When is the wedding?', kind: 'onboarding',
    links: [{ href: '/reminders', label: 'Make my dated plan ›' }, { href: HOME, label: 'Skip ›' }],
    coming: 'Not in this build yet.' },
  { route: '/reminders', file: 'app/reminders.tsx', title: 'Reminders', kind: 'onboarding', back: '/welcome',
    links: [{ href: HOME, label: 'Turn on reminders ›' }, { href: HOME, label: 'Skip ›' }],
    coming: 'Not in this build yet.' },
  { route: '/plan', file: 'app/(tabs)/plan/index.tsx', title: 'Your plan', kind: 'tab', tab: 'plan',
    links: [{ href: '/plan/wedding-week', label: 'Your wedding week ›' }, { href: '/plan/add-task', label: '+ Add your own task' }, { href: '/plan/ai-draft', label: 'Draft my plan from a sentence ›' }],
    coming: 'Not in this build yet.' },
  { route: '/plan/add-task', file: 'app/(tabs)/plan/add-task.tsx', title: 'Add your own task', kind: 'sheet', tab: 'plan', back: '/plan',
    links: [], coming: 'Not in this build yet.' },
  { route: '/plan/ai-draft', file: 'app/(tabs)/plan/ai-draft.tsx', title: 'Draft my plan', kind: 'sub', tab: 'plan', back: '/plan',
    links: [], coming: 'Not in this build yet.' },
  { route: '/traditions', file: 'app/(tabs)/traditions/index.tsx', title: 'Your traditions', kind: 'tab', tab: 'traditions',
    links: [], coming: 'Not in this build yet.' },
  { route: '/two-phones', file: 'app/(tabs)/two-phones/index.tsx', title: 'Plan on two phones', kind: 'tab', tab: 'two-phones',
    links: [], coming: 'Not in this build yet.' },
  { route: '/more', file: 'app/(tabs)/more/index.tsx', title: 'More', kind: 'tab', tab: 'more',
    links: [{ href: '/more/packet', label: 'Print or send my plan ›' }, { href: '/more/full-plan', label: 'The full plan ›' }, { href: '/welcome', label: 'Change the wedding date ›' }],
    coming: 'Not in this build yet.' },
  { route: '/more/full-plan', file: 'app/(tabs)/more/full-plan.tsx', title: 'The full plan', kind: 'sub', tab: 'more', back: '/more',
    links: [], coming: 'Not in this build yet.' },
];
export const byRoute = (route: string) => {
  const s = SCREENS.find(x => x.route === route);
  if (!s) throw new Error(`NAMED STOP [SCREEN_NOT_IN_PLAN] ${route}`);
  return s;
};
