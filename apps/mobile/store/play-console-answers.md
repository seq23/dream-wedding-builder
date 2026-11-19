# Google Play Console answers: Dream Wedding (Android)

Paste-ready answers for the Play Console "App content" forms, read from the code on `main` (19 Nov 2026).
Paths are under `apps/mobile/` unless they start with `/` (repo root). They match the App Store privacy
label in `/docs/app-privacy.md` and the policy at https://weddingchecklistpdf.com/privacy
(`/app/privacy/page.tsx`); when the app starts or stops sending something, change all three and both
store forms together. Nothing here has been entered in Play Console yet.

Partner sharing is switched off in store builds (`src/sharingSwitch.ts:5`, `EXPO_PUBLIC_DW_SHARING` not
set), so it is not declared below. Turning it on means revisiting Data safety (the encrypted shared copy
on our server, `/app/privacy/page.tsx:153-155`) and the content rating question on sharing.

## Data safety

**Does the app collect or share any of the required user data types?** Yes.

| Play data type | Collected | Shared | Optional? | Purpose | Source |
|---|---|---|---|---|---|
| App activity → Other user-generated content (what she writes in "Describe my wedding", up to 400 characters; the AI draft sentence; her town, guest count, budget range) | Yes | **Yes**: sent to a free Google Gemini or OpenRouter model that may use it to improve its products | Optional (the free plan works without it; the AI draft needs its tick box, `app/(tabs)/plan/ai-draft.tsx:69,72`) | App functionality | `src/journey.ts:84-88`, `src/aiDraft.ts:18-19`; policy `/app/privacy/page.tsx:78-84` |
| Personal info → Religious beliefs, and Race and ethnicity (the tradition she picks: Catholic, Jewish, Hindu, Muslim nikah, Nigerian traditional, Mexican, Chinese tea ceremony) | Yes | **Yes**: same free AI model | Optional | App functionality | `src/journey.ts:88` (`tradition`), `src/traditionPacks.ts:8-14`; policy `/app/privacy/page.tsx:79` |
| App activity → App interactions (the choices she tapped: season, setting, moods, colours read from photos on the phone) | Yes | **Yes**: same free AI model | Optional | App functionality | `src/journey.ts:87` |
| App activity → App interactions (one "plan reached" signal per installation) | Yes, when the store build has `EXPO_PUBLIC_DW_METRICS=1` | No | Required in those builds | Analytics | `src/phoneMetrics.ts:7`, `src/planReach.ts:28-29`; `/docs/APP_MEASUREMENT.md` |
| Device or other IDs (a random installation number for that signal; RevenueCat's anonymous app user ID, sent as the bearer to fetch paid files) | Yes | No | Required | Analytics (installation number); App functionality (RevenueCat ID) | `src/planReach.ts:29`, `src/billing/downloadStore.ts:122`, `src/billing/revenuecat.ts:18` |
| Financial info → Purchase history | Yes, through Google Play Billing and RevenueCat (service provider) | No | Required to buy or restore | App functionality, Analytics | `src/billing/revenuecat.ts:18`; policy `/app/privacy/page.tsx:152-153` |

Declaring tradition as religious beliefs and ethnicity is the cautious reading: Apple has no such type, so
the App Store label carries it under Other User Content; Play does have one, and the AI provider receives it.
The wedding town is the event's place, typed by her, not her device location, so it is user content, not
Location. No location permission exists (`app.config.ts:18`).

**Not collected (answer "No" for every other type), and why:**

- **Photos:** read for colours on the phone; only colour values leave (`src/journey.ts:87`, `photos.slice(0, 3).map(p => ({ loves, colours }))`; `app.config.ts:23-24`).
- **Email, name, phone, contacts:** the app asks for none. The AI draft sends no email (`src/aiDraft.ts:19`).
- **Date, tasks, ticks, payments she notes, reminders:** kept on the phone; reminders are local notifications (`/app/privacy/page.tsx:150-151`; no push token call in `app/` or `src/`).
- **"Report this answer":** opens her own mail app with the answer quoted (`src/reportAnswer.ts:15-19`); the app sends nothing itself.
- **Crash logs, diagnostics, advertising ID:** no analytics, crash or ad SDK; RevenueCat diagnostics and automatic device identifiers are off (`src/billing/revenuecat.ts:18`).
- The server keeps a salted one-way hash of the connection's address to count three free AI answers a day (`/migrations/0011_wedding_reads.sql`, `ip_hash`); not used for location.

**Is all user data collected by your app encrypted in transit?** Yes: every call goes to `https://weddingchecklistpdf.com` (`src/journey.ts:20`, `src/aiDraft.ts:1`, `src/planReach.ts:28`, `src/billing/downloadStore.ts:7`), plus RevenueCat and Google Play over HTTPS.

**Do you provide a way for users to request that their data be deleted?** Yes.
- On the phone: More › "Delete my plan from this phone" (`app/(tabs)/more/index.tsx:117`).
- We do not store what she wrote (`/app/privacy/page.tsx:87`). For anything else (purchase record, hashes), email info@weddingchecklistpdf.com (`/data/products/product_catalog.json:4`), with the Google Play order number (GPA.…) for a purchase.
- Deletion URL (Play requires one only for apps with accounts; this app has none): `https://weddingchecklistpdf.com/privacy`.

**Account creation:** none. **Independent security review:** no. **Families policy:** not in the Families program.

## Content rating (IARC questionnaire)

Category: **Utility, Productivity, Communication or other** (a wedding planner).

| Question | Answer | Why |
|---|---|---|
| Violence, blood, sexual content, nudity, profanity, crude humour | No | Planning text only; AI answers come from `/lib/wedding-read.ts` and, past the daily three, from our fixed lists (`store/google-play.md`, Full description) |
| Drugs, alcohol, tobacco | No | No such content; planning tasks only |
| Gambling, simulated gambling | No | |
| Users can interact or exchange content with each other | No | Partner sharing is off in store builds (`src/sharingSwitch.ts:5`) |
| Shares the user's current physical location | No | No location permission (`app.config.ts:18`) |
| Allows purchases of digital goods | Yes | Full plan, Planner + Printables, Day-of kit, printables top-up, a new event (`src/billing/offers.ts`) |
| Unrestricted internet access | No | Fixed links (terms, privacy, disclaimer, tradition sources) open the phone's browser |
| Generative AI content | Yes, the wedding description and the AI draft (see "AI-generated content" below) | |

Expected rating: Everyone / PEGI 3.

## Target audience and content

- **Target age:** 18 and over only. The app plans the user's own wedding, sells to the adult planning it and has no child-directed content or age gate (`app/`, `src/`).
- **Appeals to children:** No.

## Ads

**Does your app contain ads?** No. No ad SDK in `package.json`; no affiliate links in `app/` or `src/` (searched `grep -rn -i "affiliate\|admob" app src`, no hits).

## App access (notes for the reviewer)

Choose **"All or some functionality is restricted"** and paste:

> No account or login. Open the app, tap "I don't know yet" (or write a sentence), keep a few ideas, then give any wedding date to get the dated plan; everything free is then open. "Describe my wedding" and the AI draft need an internet connection and allow three AI answers a day. Paid parts (full plan, Planner + Printables, Day-of kit) are under More › "See the full plan ›" and are bought with Google Play Billing; please use a license-testing account. Partner sharing is not in this version. If a reviewer account is needed it is provided here in Play Console, never in the app.

(No credentials exist or are needed; nothing goes in the repo. Paywall entry: `app/(tabs)/more/index.tsx:102`.)

## AI-generated content declaration

- **Does the app generate content with AI?** Yes: "Describe my wedding" (`app/feel.tsx`, via `src/journey.ts:84` → `/app/api/wedding-read/route.ts`) and the AI plan draft (`app/(tabs)/plan/ai-draft.tsx`, via `src/aiDraft.ts:18` → `/lib/ai-draft.ts`). Text only; no images, audio or video are generated.
- **Users can report or flag offensive AI content in the app:** Yes, "Report this answer" under both AI answers (`app/feel.tsx:250`, `app/(tabs)/plan/ai-draft.tsx:57`), on for Android (`src/reportAnswer.ts:10-12`). It opens a pre-filled email to info@weddingchecklistpdf.com with the answer quoted (`src/reportAnswer.ts:15-19`); reports are read by a person at that address.
- **Labelled as AI in the app and listing:** the Play draft says "written by an AI planner, not a person" (`store/google-play.md`, Full description); the AI draft screen asks permission before sending (`app/(tabs)/plan/ai-draft.tsx:69`).
- **Guardrails:** never names businesses, prices or availability; emails, phone numbers, street addresses and links are removed before sending (`/app/privacy/page.tsx:80-81`).

## Other declarations

| Form | Answer | Why |
|---|---|---|
| Financial features | None | Notes the payments she owes vendors on the phone; no banking, loans, payments between people, crypto or trading |
| Health apps | No / none | |
| Government apps | No | |
| News apps | No | |
| COVID-19 contact tracing or status | No | |
| Advertising ID | Not used | No ad or attribution SDK (`src/billing/revenuecat.ts:18`) |
| Photo and video permissions declaration | Not needed | `READ_MEDIA_*` and storage blocked (`app.config.ts`, `blockedPermissions`); the system photo picker needs no permission |
| Exact alarm / full-screen intent | Not needed unless the built manifest lists them (see the PR for the list read from the APK) | Reminders are ordinary local notifications |
