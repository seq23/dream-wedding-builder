// The one switch for partner sharing (two phones). The server route is off in production
// (docs/app-sharing-protocol.md), so the app neither sells sharing nor shows its controls
// until EXPO_PUBLIC_DW_SHARING=1 is set for a build. Turning it on is this one env value;
// the sharing code under src/sharing stays as it is.
export const SHARING = process.env.EXPO_PUBLIC_DW_SHARING === '1';

/** What the full plan adds, as listed on the full-plan (paywall) screen. */
export function fullPlanLines(sharing: boolean = SHARING): string[] {
  const lines = ['Payments and the final-payment schedule', 'Your wedding-week sheet, with who to call', 'The printable hand-over packet with payments and contacts', 'Every tradition pack', 'Reminders for your dated tasks'];
  return sharing ? [...lines, 'A second phone for your partner'] : lines;
}

/** The one-line summary of the full plan (More, and the full plan's offer card). */
export function fullPlanSummary(sharing: boolean = SHARING): { short: string; offer: string } {
  return sharing
    ? { short: 'payments, your wedding week, reminders and a second phone for your partner', offer: 'Payments, your wedding week, the hand-over packet, every tradition pack, reminders and a second phone.' }
    : { short: 'payments, your wedding week and reminders', offer: 'Payments, your wedding week, the hand-over packet, every tradition pack and reminders.' };
}

/** The Two phones link on More, or null when sharing is off (nothing to tap). */
export function twoPhonesLink(paid: boolean, sharing: boolean = SHARING): { href: string; label: string } | null {
  if (!sharing) return null;
  return paid ? { href: '/more/sharing', label: 'Two phones: share with my partner ›' } : { href: '/more/full-plan', label: 'Two phones ›' };
}

/** Whether the sharing screen may show its controls (Send the link, Join, Stop sharing). */
export function sharingControlsShown(sharing: boolean = SHARING): boolean { return sharing; }
