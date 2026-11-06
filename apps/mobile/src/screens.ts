// Every screen in the plan (docs/APP_PLAN.md, section Screens), in the order a couple
// meets them. test/screens.unit.ts fails if a screen here has no route file in app/, or
// a route file is not listed here, so the plan and the app cannot drift apart.
export interface ScreenSpec { route: string; file: string; title: string; planned: string }
export const SCREENS: ScreenSpec[] = [
  { route: '/welcome', file: 'app/welcome.tsx', title: 'When is the wedding?', planned: 'Pick the date (or "not set yet"); the dated plan is built from it. Codex task 1.' },
  { route: '/reminders', file: 'app/reminders.tsx', title: 'Reminders', planned: 'One reminder at the start of each planning window, for tasks not yet ticked. Codex task 4.' },
  { route: '/plan', file: 'app/(tabs)/plan.tsx', title: 'Your plan', planned: 'The binder: window tabs, tick tasks, add your own. Codex task 2.' },
  { route: '/add-task', file: 'app/add-task.tsx', title: 'Add your own task', planned: 'Bottom sheet: task words and which window. Codex task 2.' },
  { route: '/traditions', file: 'app/(tabs)/traditions.tsx', title: 'Your traditions', planned: 'Add a tradition’s common tasks into the dated plan (full plan). Codex task 5.' },
  { route: '/two-phones', file: 'app/(tabs)/two-phones.tsx', title: 'Plan on two phones', planned: 'Share one plan with your partner by a private link (full plan). Codex task 7.' },
  { route: '/ai-draft', file: 'app/ai-draft.tsx', title: 'Draft my plan from a sentence', planned: 'One free AI draft on $0 free models, through the live Builder’s API. Codex task 6.' },
  { route: '/full-plan', file: 'app/full-plan.tsx', title: 'The full plan', planned: 'One payment, no subscription: 104 dated tasks, two phones, every reminder, traditions, handover pack, PDF; Planner + Printables as the better value. Built switched off. Codex task 8.' },
  { route: '/more', file: 'app/(tabs)/more.tsx', title: 'More', planned: 'Date, reminders, AI draft, full plan, printables, privacy, restore, delete. Codex task 9.' },
];
export const byRoute = (route: string) => {
  const s = SCREENS.find(x => x.route === route);
  if (!s) throw new Error(`NAMED STOP [SCREEN_NOT_IN_PLAN] ${route}`);
  return s;
};
