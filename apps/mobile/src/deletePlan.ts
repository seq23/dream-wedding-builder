// Explicit content keys: never erase store receipts or paid-event history.
export const planContentKeys = [
  'dw.sharing.session.v1', 'dw.sharing.owner-plan.v1', 'dw.sharing.payments.v1', 'dw.sharing.week.v1', 'dw.sharing.error.v1',
  'dw.billing.downloads.v1', 'dw.event-name.v1', 'dw.new-event-name.v1',
  'dw.billing.active-event.v1', 'dw.week.v1', 'dw.week.preview.v1', 'dw.wedding-date.v1', 'dw-plan-progress',
  'dw.planning-details.v1', 'dw.ai-signups.v1', 'dw.ai-marketing.v1',
  'dw.payments.v1', 'dw.payments.preview.v1', 'dw.reminders.error.v1', 'dw.plan-started.v1',
  // The saved journey (typed wish, town, guests, budget, tradition, colours, AI answer, picks), the
  // after-wedding ticks, the reminder choice, the rating-ask state and the sharing actor id: all of
  // them are things the app kept about this plan (promise audit, 27 Nov 2026).
  'dw.journey.v1', 'dw.after-wedding.kept.v1', 'dw.reminders.choice.v1', 'dw.rating.v1', 'dw.sharing.actor.v1',
];

/** Kept on purpose: paid-event history (so purchases can be restored) and the random installation
 * number (docs/APP_MEASUREMENT.md: it survives a delete so a new plan cannot count twice). */
export const keptKeys = ['dw.billing.events.v1', 'dw.metrics.installation.v1', 'dw.metrics.reached.v1'];

export async function deleteLocalPlan(
  storage: { removeMany(keys: string[]): Promise<void> },
  stopReminders: () => Promise<void>,
  drainProgress: () => Promise<unknown>,
  removeArchives: () => Promise<void> = async () => {},
  stopSharing: () => Promise<void> = async () => {},
) {
  // The inviting phone ends the share first, so the partner's phone does not keep
  // the paid plan until the link expires. Best effort: offline never blocks deletion.
  await stopSharing().catch(() => {});
  // A cancellation failure must stay visible; do not claim deletion succeeded.
  await stopReminders();
  await drainProgress();
  await removeArchives();
  await storage.removeMany(planContentKeys);
}
