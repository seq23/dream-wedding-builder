// Explicit content keys: never erase store receipts or paid-event history.
export const planContentKeys = [
  'dw.sharing.session.v1', 'dw.sharing.owner-plan.v1', 'dw.sharing.payments.v1', 'dw.sharing.week.v1', 'dw.sharing.error.v1',
  'dw.billing.downloads.v1', 'dw.event-name.v1', 'dw.new-event-name.v1',
  'dw.billing.active-event.v1', 'dw.week.v1', 'dw.week.preview.v1', 'dw.wedding-date.v1', 'dw-plan-progress',
  'dw.planning-details.v1', 'dw.ai-signups.v1', 'dw.ai-marketing.v1',
  'dw.payments.v1', 'dw.payments.preview.v1', 'dw.reminders.error.v1',
];

export async function deleteLocalPlan(
  storage: { removeMany(keys: string[]): Promise<void> },
  stopReminders: () => Promise<void>,
  drainProgress: () => Promise<unknown>,
  removeArchives: () => Promise<void> = async () => {},
) {
  // A cancellation failure must stay visible; do not claim deletion succeeded.
  await stopReminders();
  await drainProgress();
  await removeArchives();
  await storage.removeMany(planContentKeys);
}
