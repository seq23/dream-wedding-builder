# App Store privacy label (App Privacy): what we declared and why

Published in App Store Connect on 16 Nov 2026 (app 6834891267). Every answer comes from the code in `apps/mobile` on `main` at that date. The label is a legal statement to Apple, so when the app starts collecting something new, or stops, update this file and the label together.

Privacy policy URL on the label: `https://weddingchecklistpdf.com/privacy`.

## Declared: Data Not Linked to You (none of it is used for tracking)

| Apple data type | Purpose | Where it comes from in the code |
|---|---|---|
| Sensitive Info | App Functionality, Other Purposes | The tradition she may pick (Catholic, Jewish, Hindu, Muslim nikah, Nigerian traditional, Mexican, Chinese tea ceremony: religious belief, and race or ethnicity), sent as `tradition` in "Describe my wedding" (`src/journey.ts`, `facts.tradition`) to the same free AI models. Optional. Play declares it as Religious beliefs and Race and ethnicity (`apps/mobile/store/play-console-answers.md`). **Added to this file 27 Nov 2026; the label in App Store Connect gets this row with the 1.0 resubmission** (not linked to you, not used for tracking). |
| Other User Content | App Functionality, Other Purposes | "Describe my wedding" (`src/journey.ts` → `/api/wedding-read`: wish, town, guest count, budget range, tradition, colours, moods) and the AI draft (`src/aiDraft.ts` → `/api/ai-draft`). These go to free Gemini or OpenRouter tiers, which may use them to improve their products; that is the "Other Purposes" answer. |
| User ID | App Functionality | The anonymous RevenueCat app user id, sent as the bearer to `/api/app-unlock` (`src/billing/downloadStore.ts`), and on Android only, with a Play review code when one is typed, to `/api/review/unlock` (`src/billing/review.ts`; iOS never sends it). The server stores only an HMAC of it, deleted 7 days after the grant ends. |
| Device ID | Analytics | The random installation number in the one-time plan-reach signal (`src/phoneMetrics.ts`, `src/planReach.ts` → `/api/app-plan-reach`) |
| Product Interaction | Analytics | The same plan-reach signal |
| Purchase History | App Functionality, Analytics | RevenueCat (`src/billing/revenuecat.ts`) |

The plan-reach signal only sends when the store build has `EXPO_PUBLIC_DW_METRICS=1`, and the EAS production environment does not set it (read 27 Nov 2026: only the two RevenueCat keys are set), so today's store builds do not send it. It stays declared: declaring more than is collected is allowed, and turning the signal on (the launch scorecard needs it) then needs no label change.

## Not declared, and why

- **Email.** The app asks for no email ("No email needed"; `app/(tabs)/plan/ai-draft.tsx`). An earlier draft label listed Email Address for marketing; it was removed.
- **Photos.** They are read for colours on the phone (`src/photos.ts`). Only colour values are sent.
- **Partner sharing.** It is end-to-end encrypted (`src/sharing/crypto.ts`, and the key stays in the link fragment). Apple does not require end-to-end encrypted data on the label.
- RevenueCat runs with diagnostics and automatic device identifiers off. There is no analytics or crash SDK, and reminders are local notifications.
- The server keeps a salted hash of the connection's address for the daily allowance. Apple has no data type for this, and it is not used for location.
- Tracking: none.

## Policy vs code

These match. The policy's "The Dream Wedding app" section describes the same flows.
