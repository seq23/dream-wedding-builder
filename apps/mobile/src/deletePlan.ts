// Explicit content keys: never erase store receipts or paid-event history.
export const planContentKeys = [
  'dw.billing.active-event.v1', 'dw.week.v1', 'dw.week.preview.v1', 'dw.wedding-date.v1', 'dw-plan-progress',
  'dw.planning-details.v1', 'dw.ai-signups.v1', 'dw.ai-marketing.v1',
  'dw.payments.v1', 'dw.payments.preview.v1', 'dw.reminders.error.v1',
];

export async function deleteLocalPlan(
  storage: { removeMany(keys: string[]): Promise<void> },
  stopReminders: () => Promise<void>,
  drainProgress: () => Promise<unknown>,
) {
  // A cancellation failure must stay visible; do not claim deletion succeeded.
  await stopReminders();
  await drainProgress();
  await storage.removeMany(planContentKeys);
}
