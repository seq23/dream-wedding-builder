// Google Play's reviewer only (REVIEW-UNLOCK-DESIGN.md). On Android, in a store build, on the full-plan screen while
// this wedding is not paid for and the server says a review window is open, a small "Have a review code?" link opens
// a 10-digit code box. The app sends only the typed code and RevenueCat's anonymous purchase ID; the server
// (lib/review-unlock.ts) checks the code and asks RevenueCat for a 7-day grant. Then the app verifies exactly like
// Restore (checkout 'review'): the server door decides what is delivered. Nothing here decides "paid".
export const REVIEW_URL = 'https://weddingchecklistpdf.com/api/review';
export type ReviewResult = 'unlocked' | 'wrong' | 'usedUp' | 'slow' | 'tryAgain';
export const REVIEW_LINK = 'Have a review code?';
export const REVIEW_BUTTON = 'Use this code';
export const REVIEW_MESSAGES: Record<Exclude<ReviewResult, 'unlocked'>, string> = {
  wrong: 'That code did not work. Check the 10 digits and try again.',
  usedUp: 'This review code has already been used on too many phones.',
  slow: 'Too many tries for now. Please wait a few minutes, then try again.',
  tryAgain: 'Could not check the code just now. Please try again in a minute.',
};
const ANON_ID = /^\$RCAnonymousID:[0-9a-f]{32}$/;

/** The link exists only on Android, with the store open, for an unpaid wedding (never on the new-event screen). */
export const reviewCodeAllowed = (os: string, storeAvailable: boolean, paid: boolean, newEvent: boolean) =>
  os === 'android' && storeAvailable && !paid && !newEvent;

async function call(transport: typeof fetch, unlock: boolean, body?: string): Promise<Response> {
  const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 10_000);
  try {
    return unlock
      ? await transport(`${REVIEW_URL}/unlock`, { method: 'POST', headers: { 'content-type': 'application/json' }, body, signal: abort.signal })
      : await transport(REVIEW_URL, { signal: abort.signal });
  } finally { clearTimeout(timer); }
}

/** True only when the server answers 200: a closed window, an error or no network all hide the link. */
export async function reviewWindowOpen(transport: typeof fetch = fetch): Promise<boolean> {
  try { return (await call(transport, false)).status === 200; } catch { return false; }
}

/** One redeem. Never throws: no network, a timeout or any odd answer is "try again", never "paid". */
export async function redeemReviewCode(code: string, appUserId: string | null, transport: typeof fetch = fetch): Promise<ReviewResult> {
  if (!/^\d{10}$/.test(code)) return 'wrong';
  if (!appUserId || !ANON_ID.test(appUserId)) return 'tryAgain';
  try {
    const res = await call(transport, true, JSON.stringify({ code, app_user_id: appUserId }));
    if (res.status === 200) return ((await res.json().catch(() => null)) as { unlocked?: boolean } | null)?.unlocked === true ? 'unlocked' : 'tryAgain';
    const error = ((await res.json().catch(() => null)) as { error?: string } | null)?.error;
    if (res.status === 403) return error === 'USED_UP' ? 'usedUp' : 'wrong';
    if (res.status === 429) return 'slow';
    return 'tryAgain';
  } catch { return 'tryAgain'; }
}
