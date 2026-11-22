// The one App Store / Google Play rating ask (launch kit, 21 Nov 2026).
//
// The platform's own sheet only (expo-store-review: SKStoreReviewController on iOS, the
// In-App Review API on Android). Apple and Google cap how often the sheet really appears;
// on top of that we ask AT MOST ONCE per install, and only:
// - after a real success moment: the plan printed or sent, or the 10th task ticked done;
// - never on the day the app was first opened (the first launch);
// - never after an error: callers call this only on their success path;
// - never behind an "are you enjoying it?" question first (review gating is against Google
//   Play policy and the FTC consumer-review rule, 16 CFR 465): we call the sheet directly.
// Pure, with the store and the sheet injected, so test/ratingAsk.unit.ts can prove the caps.

export const RATING_KEY = 'dw.rating.v1';
/** Ticking this many tasks done is a success moment (about a tenth of the full plan). */
export const TASKS_MOMENT = 10;

export type RatingMoment = { kind: 'packet' } | { kind: 'tasks'; done: number };
type Saved = { firstSeenOn?: string; askedOn?: string };
export type KeyValue = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
export type ReviewSheet = { isAvailableAsync(): Promise<boolean>; requestReview(): Promise<void> };

const day = (now: Date) => now.toISOString().slice(0, 10);
async function read(store: KeyValue): Promise<Saved> {
  try { const raw = await store.getItem(RATING_KEY); return raw ? JSON.parse(raw) as Saved : {}; } catch { return {}; }
}

export function isSuccessMoment(moment: RatingMoment): boolean {
  return moment.kind === 'packet' || (moment.kind === 'tasks' && moment.done >= TASKS_MOMENT);
}

export function ratingAsk(store: KeyValue, sheet: ReviewSheet, now: () => Date = () => new Date()) {
  return {
    /** Called once each time the app opens: remembers the first day, so that day never asks. */
    async opened() {
      const saved = await read(store);
      if (!saved.firstSeenOn) await store.setItem(RATING_KEY, JSON.stringify({ ...saved, firstSeenOn: day(now()) })).catch(() => {});
    },
    /** Called on a success path. Returns true only when the platform sheet was requested. */
    async moment(moment: RatingMoment): Promise<boolean> {
      if (!isSuccessMoment(moment)) return false;
      const saved = await read(store);
      if (saved.askedOn) return false; // once per install
      if (!saved.firstSeenOn || saved.firstSeenOn >= day(now())) return false; // never on the first launch day
      if (!(await sheet.isAvailableAsync().catch(() => false))) return false; // web preview, or no store on the device
      // Recorded before the sheet is shown, so a crash or a second tap can never ask twice.
      await store.setItem(RATING_KEY, JSON.stringify({ ...saved, askedOn: day(now()) }));
      await sheet.requestReview().catch(() => {});
      return true;
    },
  };
}
