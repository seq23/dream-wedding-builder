# Dream Wedding phone app: plan and build list

The plan, with every screen drawn at 390 x 844, the features (v1, later, never), money,
the store listing draft, risks and the scorecard row, is one page:
**https://claude.ai/artifact/HNe4dvboPvaTNgb4mDu7Yq** (6 Nov 2026). This file is the
repo copy of what Codex builds, in order. When the two disagree, the page wins; fix this file.

## What is already here (scaffold, 6 Nov 2026)

- `apps/mobile`: an Expo app on the KeepMyProof stack (Expo 58, expo-router, EAS
  profiles copied from KeepMyProof). Name "Dream Wedding", bundle id placeholder
  `com.weddingchecklistpdf.dreamwedding.placeholder`, light only.
- Brand: `src/theme.ts` holds the approved tokens (design system
  https://claude.ai/artifact/6ncBMWsGoHNHP16FzbmM9o); Instrument Serif, Instrument Sans
  and DM Mono are bundled. `scripts/make-icons.mjs` draws the icon, adaptive icon and
  splash from the tab mark (`npm run icons`).
- Screens: `src/screens.ts` lists the nine screens of the first plan (tasks 8a to 8c add Payments, Wedding week and the packet; add them to the list); each has an empty route
  in `app/`. `test/screens.unit.ts` fails if the list and the routes drift apart.
- Shared logic: the app imports the live Builder's own `lib/dated-plan.ts`,
  `lib/plan-progress.ts` and `lib/plan-ics.ts` through `@core/*` (tsconfig paths +
  `metro.config.js` watchFolders). Never copy them into the app. `test/core.unit.ts`
  pins the shared behaviour (218 days, the window dates, ticks, reminder dates).
- CI: `.github/workflows/mobile-preview.yml` runs `npm run check` (typecheck + unit tests,
  5 minutes) and then builds the iOS simulator app and puts it on Appetize (copied from
  KeepMyProof; secret `APPETIZE_API_TOKEN`, optional variable
  `APPETIZE_DREAM_WEDDING_PUBLIC_KEY`). It runs only for `apps/mobile/**`, the three shared
  `lib/` files and itself. No token: NAMED STOP [APPETIZE_TOKEN_MISSING] in the summary.
- The website is untouched: the root `tsconfig.json` excludes `apps`, so the site's
  typecheck and build never read the app. Proven on 6 Nov: the site's `next build`
  output before and after the scaffold had 381 of 461 files byte-identical and the other
  80 manifests differed only in key order and Next's per-build random preview keys.

Run locally: `cd apps/mobile && npm ci && npm run check`.

## Who we win, and what the paid plan sells (owner, 10 Nov 2026: "let's make sure we are doing what we can win")

The bride we can honestly win wants a plan in a minute, with no account, nobody selling to her, and
paper she can hand to her mother or the friend running the day. The app is built for her, not as
"the checklist in an app" (source: the value review of 10 Nov 2026, `dw-value-review.md`).
- **The free part mirrors the repaired website: plan first.** Date in, dated plan on screen. No
  account and no email to see or use the plan; the email is asked only for the AI draft, and the
  marketing tick is separate, optional and unticked (site PRs #124 to #128). The free plan opens on
  "Do these next" (the next three unticked tasks with dates, and when the next set starts) and shows
  two locked full-plan tasks per window with her dates, as the site does.
- **What `full_plan` sells, in this order:** (1) the payments and final-payment schedule, (2) the
  wedding-week sheet, (3) the dated hand-over packet she can print or send, (4) her partner joining
  on a second phone at no extra cost. Screen 2, the paywall and the store listing lead with these.
- **Reminders stay paid, but they are not the selling point.** One line why: the largest competitor
  gives dated tasks, tradition tasks and reminders free, so reminders alone will not sell $14.99
  (value review, section 2 and section 4). Store wording never leads with reminders or "checklist".
- **Day-30 check (goes on the scorecard row, task 13).** If, 30 days after launch, unlocks per 100
  people who reach the plan screen are under the row's day-30 floor, switch to **version B:
  reminders free, payments + packet paid**. B is written now so the switch is a config change:
  the reminder scheduler reads one flag (`remindersNeedFullPlan`), and nothing else about `full_plan`
  moves. Prices and paid-once-per-event do not change in either version.
- **Counts are never typed.** The full task list is one private file (the same one the website's $9
  plan reads: R2 `plans/checklist-full-plan-v1.json`, 100 tasks on 10 Nov 2026, 10 of them payment
  tasks). Screens and store text read the list's real length; "104" was the row count of an empty
  workbook and is retired everywhere.

## Paid content is never in the public repo or the app bundle (10 Nov 2026; build it this way from the start)

This repo is public and anything inside an app bundle can be read out of it, so paid content ships
only after a confirmed purchase:
- **Bundled in the app (free):** the 23 free tasks from `lib/dated-plan.ts`, each tradition pack's name and
  one example task (the preview), the screens, and short fake fixtures for tests.
- **Delivered after purchase:** the rest of the full task list (every task beyond the free ones, with
  its date offset, suggested owner and payment marker), the full tradition packs, the day-of handover
  pack and the printables. Their sources live outside the repo (`~/.boss-os/dream-wedding/`; the task
  list is `full-plan-tasks.json`, uploaded as `plans/checklist-full-plan-v1.json` to the existing R2
  bucket `dream-wedding-builder-products`, the same object the website reads), never committed.
  The only paid task names in the repo are the two per window the free plan shows locked
  (`lib/full-plan-teaser.ts`, on main).
- **The door:** a Worker route `/api/app-unlock` checks the purchase with RevenueCat's server API
  (secret on the Worker only) and returns short-lived signed links; the phone downloads once, keeps
  it, and works offline after. No RevenueCat secret yet = NAMED STOP [REVENUECAT_SECRET_MISSING]
  and the buy button stays off. Restore re-runs the same door.
- Tests: a check fails if any paid task, full pack or printable text is in `apps/mobile` or the repo;
  the route refuses without a confirmed entitlement and answers the same for unknown and refused.
- Task 5 (tradition packs) writes the full packs to the private folder and only the previews to the
  repo; Claude reads every pack before it is uploaded.

## Built for 100 paying customers a day (owner, 10 Nov 2026: "begin with the end in mind, build for 100 customers or more per day")

Design target: **100 purchases a day per app**, which at 3 to 6% of free users buying means about
**2,000 to 3,000 people a day** using the free part. Every task is built to that load at $0.
- **On the phone, so it scales at $0:** plan, ticks, own tasks, traditions, reminders, PDF. No limit.
- **The AI draft is a bonus, never a step the plan needs.** Free models cannot serve 3,000 a day (OpenRouter's
  free models allow about 1,000 requests a day per account, shared with this repo's jobs). The draft screen
  shows the plain form first (date, guests, place, budget, what matters most) and offers "Fill it from a
  sentence (free AI) ›" as an extra; when the daily ceiling is reached it says "The free AI helper is full
  for today. Fill in the form; it takes a minute." Ceiling stays on the server (`AI_DRAFT_DAILY_CEILING`).
- **Two phones (task 7):** sized for 3,000 shares a day inside Cloudflare's free allowance; the daily ceiling
  is set from that, not from today's traffic.
- **Purchases:** the stores and RevenueCat carry any volume; Restore must work with no support email.
- **Load check before the store step:** a script replays one day at the target (3,000 plan opens, 1,000
  share writes, 3,000 AI-draft requests against a mocked model) against a preview Worker and fails if any
  free path errors or any ceiling lets a cost through. Named stop on failure.

## Rules for every task

- Read `~/Brains/spry.md` (Dream Wedding brand) and `~/Brains/risk.md` first.
- $0 only. The app never holds a model key or calls a model; the AI draft goes through the
  live `/api/ai-draft`, which tries OpenRouter free models only (`lib/ai-draft.ts`).
- Never create anything in RevenueCat, Stripe, Gumroad or either store; she does.
- No accounts or passwords. The plan works with no email; only the AI draft asks for one.
- Brand do-not list: no human planner implied, no countdown pressure, streaks or invented
  numbers, no competitor names in app or store text.
- Each task is its own PR with its tests; Claude reviews the diff before it lands; the
  Appetize preview stays green so she can tap every build.
- Changes to site files (tasks 7 and 10) are their own PRs and keep the site's search
  shape (headings, FAQ, schema, links) word for word.

## Codex's build list (Tue 10 Nov), in order

1. **Store the date on the phone.** Screen 1 saves the date or "not set yet"; the app then
   opens on the plan (`app/index.tsx`).
   Tests: reopening keeps the date; "not set yet" shows the plan without dates; a past date
   and 29 Feb 2028 show lib/dated-plan's own wording.
2. **The plan screen and your own tasks.** Binder tabs per window, the catch-up row, tick
   with a time stamp, add/edit/remove your own task in a bottom sheet, using
   lib/plan-progress as is.
   Tests: a tick stamps the time and the row stays put; untick clears it; the count equals
   ticked / all tasks, own tasks included; own task text over 140 characters is cut as on
   the site.
3. **Preview shortcut for Appetize.** Appetize sessions end after about 3 minutes, so a
   preview build (flag `EXPO_PUBLIC_DW_PREVIEW=1`, set in the preview workflow) offers
   "Preview only: open a sample plan ›" (12 Jun 2027, 2 ticks, 1 own task), as KeepMyProof.
   Tests: the shortcut exists only with the flag; task 11's check refuses a store build
   with it set.
4. **Reminders.** expo-notifications, local only: 9:00 on each future window start, listing
   unticked tasks; rescheduled on every tick, task or date change; asked once on screen 2.
   **Reminders are paid** (owner, 10 Nov 2026: "If the apps are sending reminders and all of
   that it should charge for that stuff"): they need `full_plan`; the free plan schedules none,
   and screen 2 offers them as part of the full plan, after payments, the wedding-week sheet, the
   packet and partner joining, never as the headline. The scheduler reads one flag,
   `remindersNeedFullPlan` (true at launch), so version B of the day-30 check is one change.
   Tests: 12 Jun 2027 seen on 6 Nov 2026 schedules 12 Dec, 12 Mar, 12 May, 5 Jun and the
   day; a fully ticked window gets none; with no `full_plan` nothing is scheduled (and with `remindersNeedFullPlan` false the free plan schedules them); nothing in the past; "Not now" never re-asks
   until turned on in More.
5. **Tradition packs.** Seven packs (Catholic, Jewish, Hindu, Muslim nikah, Nigerian
   traditional, Mexican, Chinese tea ceremony) as data files; each task has a window id,
   its words and a source link. Adding merges into own tasks, marked with the pack.
   Tests: every task has a source and a real window id; adding twice adds nothing;
   removing a pack keeps ticked or edited tasks. Claude reads every pack before it lands.
6. **The AI draft.** Screen 7 is the only place the app asks for an email. It calls
   `/api/builder-signup` (only if the email is new; `marketing` is her own optional, unticked box,
   sent as true only when she ticks it) and then `/api/ai-draft`; it shows the
   server's messages word for word. Nothing is sent until the "send to a free AI model" box
   is ticked (Apple 5.1.2).
   Tests (server mocked): disabled, busy, used, per-connection and daily-limit replies each
   show the server's sentence; a check fails if any model address or key is in the app.
7. **Two phones.** Site PR: `/api/plan-share` on the Worker (app-security shape: 256 KB
   cap (raised from 64 KB on 13 Nov 2026: the real list, packs and ticks pass 64 KB), per-IP limit via lib/abuse-limits, a daily ceiling, additive migration, stores
   only ciphertext under a random id). App PR: encrypt with the key in the link fragment
   (@noble/ciphers, as KeepMyProof); merge ticks by latest stamp.
   Tests: over the cap → 413; over the limit → 429; an unknown id and a wrong key answer the
   same; the key never reaches the server; two phones ticking different tasks keep both.
   **Partner joining is a later task, not part of the first build.** It is sold as part of
   `full_plan` from day one only if it ships; until it does, no screen or store text mentions
   it. Accepted when: she taps "Invite my partner", sends one link, and the partner's phone shows
   the same event fully unlocked with no account and no second purchase; a tick or a payment
   marked on either phone shows on the other within a minute of both being online; stopping
   sharing removes the paid tasks from the joined phone and nothing from hers.
8. **The products, switched off.** RevenueCat wiring copied from KeepMyProof
   (`src/billing`) with no key; the screen says "Purchases are not set up yet".
   NAMED STOP [DW_STORE_NOT_SET_UP] until she has created the store accounts, the products
   and RevenueCat herself. Prices approved 6 Nov 2026; all one-time (non-consumable):

   | Product ID (Apple and Google) | Price | Grants entitlements |
   |---|---|---|
   | `dw_full_plan` | $14.99; $9.99 for the first 30 days by a scheduled store price change (intro offers are subscriptions only) | `full_plan` |
   | `dw_planner_printables` | $34.99 | `full_plan`, `printables`, `day_of_kit` |
   | `dw_printables_topup` | $19.99 (owners of the full plan only; $14.99 + $19.99 = the bundle) | `printables` |
   | `dw_day_of_kit` | $9.99 | `day_of_kit` |
   | `dw_new_event` (consumable) | $14.99, the full-plan price of the day | `full_plan` for one new event |

   `full_plan` unlocks, in the order it is sold (see "Who we win"): the payments and
   final-payment schedule, the wedding-week sheet, the dated hand-over packet (PDF export), a
   partner joining on a second phone (task 7), every task in the full list dated (the count is
   read from the list), tradition packs (task 5) and every window's reminders (task 4).
   Free (same as the website): the free core tasks in `lib/dated-plan.ts` (23), ticks, own tasks,
   "Do these next", the calendar file, 1 AI draft, the basic packet; no reminders (owner, 10 Nov 2026). Offering `default`:
   dw_planner_printables first (better value), then dw_full_plan; offering `after_unlock`
   (owns `full_plan`, not `printables`): dw_printables_topup, then dw_day_of_kit; owns
   `printables`: no offer. The rule is one pure function, `offersFor` in
   `apps/mobile/src/billing/offers.ts` (already in the scaffold, guarded by
   `test/offers.unit.ts`); screens never decide offers themselves. Prices come from the store at run time, never typed into the app.
   Printables are digital content, so in-app purchase only (Apple 3.1.1); download from
   our server after the store confirms; restorable.
   **The full plan is paid once per event** (owner, 10 Nov 2026: "if they want to start over
   and plan an entirely new event we charge again but editing an existing event (within
   reason) is free and we make some things lock once they pay"). Wins over the plan page.
   - **The event:** at unlock the couple types the event's name ("Maya & Jordan's wedding"),
     kept on the phone. Once paid, **the name locks** (shown with a lock, no edit).
   - **Free edits, within reason:** tasks, ticks, own tasks, traditions and reminders, always.
     **The date may move up to 3 times** after unlock (postponements); each move shows
     "2 date changes left for this event". A 4th change needs a new event.
   - **A new event is a new purchase:** "Start a new event ›" in More says the price first
     ("A new event is a new full plan: $14.99, paid once. This event stays as it is.") and buys
     `dw_new_event`. Deleting the plan never refunds or frees an event.
   - **The couple pays once:** a phone that joins a shared plan (task 7) sees that event fully
     unlocked while joined, with no second purchase.
   - **Store shape:** the first event is `dw_full_plan` (non-consumable, so Restore on a new
     phone always brings it back); each further event is `dw_new_event`, a **consumable**
     at the same price, since a non-consumable can be bought only once. A consumable cannot be
     restored by the store, so each paid event's unlock is recorded on the phone and inside the
     event's private shared-plan backup (task 7), and Restore reads both. Printables
     (`printables`, `day_of_kit`) stay once per person, every event.
   - Reminders, two phones, traditions, payments and the full task list belong to the event that was paid for.
   Tests: with no key every buy button is off and free features never check a purchase;
   each product grants exactly its entitlements; a joined phone with no purchase sees every task of the shared plan (the full list's own count) and loses them when sharing stops; the name cannot be edited after unlock; date moves 1 to 3 keep the unlock and the 4th is refused with the new-event offer; a new event without `dw_new_event` stays on the free plan; deleting and recreating never unlocks a new event; Restore brings back the first event and every recorded paid event; `offersFor` keeps passing (full plan owners
   see the top-up, never the bundle; printables owners see nothing); restore brings back all three; printables download only after a
   confirmed purchase; no product, offering or price is created by code.
1a. **A preview link she can open (coordinator, 10 Nov 2026; do this before task 2).** The owner
   sees every build from a link, never a download. The preview job publishes the web export to
   Cloudflare Pages (project `dream-wedding-app-preview`, created by the job if missing; repo secrets
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` already exist; free plan only) with
   `npx wrangler pages deploy <export dir> --project-name dream-wedding-app-preview --branch <pr branch>`
   and prints the URL as the first line of the run summary and as a PR comment. The page carries
   `noindex`. No token or a refused deploy: NAMED STOP [PREVIEW_HOST_FAILED], and the job fails.
   Tests: the workflow fails when the deploy step prints no URL.
8a. **Payments and the final-payment schedule (the first thing `full_plan` sells; coordinator,
   10 Nov 2026: the plan sold these with no task to build them).** A "Payments" tab: every payment
   task from the full list (its `kind` is `payment`) dated from her date, plus her own payments:
   who is paid, amount, due date, paid or not, how it is paid. Line 1 is the count and total still
   owed ("3 payments left · $4,200"). Marking paid stamps the day. Amounts live on the phone only.
   Free plan: the tab shows the two locked payment tasks with her dates and what the full plan adds.
   Tests: totals equal the unpaid rows; a paid row leaves the total; with no `full_plan` no paid
   task text is on the phone; amounts never leave the phone (no network call in this screen).
8b. **The wedding-week sheet.** One screen for the last seven days: the wedding-week tasks from the
   full list by day, each with its suggested owner and a "Who" she can set, the vendor contact sheet
   (name, phone, arrival time, who calls if late) and the envelopes list from the payment tasks.
   Tests: tasks sort by day; a task ticked here is ticked on the plan; needs `full_plan`.
8c. **The hand-over packet.** "Print or send my plan": one PDF (expo-print) built on the phone:
   names and date on top, every task with date, owner and a "Who" blank, the payments schedule, the
   wedding-week sheet and the contact sheet; black on white; Letter and A4. Shared by the system
   share sheet; nothing is uploaded. The free plan keeps the basic packet (the 23 free tasks).
   Tests: the paid packet holds every task of the delivered list (the list's own count); the free
   packet holds no paid task; both page sizes produce a file.
   Tasks 8a to 8c read the delivered full list (see "Paid content is never in the public repo");
   until the purchase door exists they are built and tested against a short fake fixture, and the
   preview build (task 3) loads that fixture so she can see them.
9. **More, and delete.** Every row on screen 9; "Delete my plan from this phone" confirms
   on the page first.
   Tests: delete clears the plan and reminders; each change shows on the plan screen.
10. **Store files.** `apps/mobile/store/en.md` from the plan page (name, subtitle, keywords,
    description, privacy answers), and an app section on the site's /privacy and /terms.
    Tests: name ≤ 30, subtitle ≤ 30, keywords ≤ 100 characters; no competitor name.
11. **The store-build check.** As KeepMyProof's `scripts/release-gate.mjs` (run from
    `eas-build-pre-install`): refuses a store build with the preview flag, the placeholder
    bundle id (NAMED STOP [BUNDLE_ID_PLACEHOLDER]) or missing privacy/terms links.
    Tests: each of the three fails alone; a clean config passes.
12. **Website line, with the app launch.** On /free-wedding-planner and the dashboard: one
    line "Get the full plan in the app ›" to the store pages. Ships the day the app is live
    in the stores, never before. Its own site PR; every H1, H2, FAQ and link keeps its words.
    Tests: the line renders only when the store links are set in config; the page's search
    shape (title, H1, H2s, FAQ, schema) is unchanged.
13. **Scorecard row** in Boss OS (result, day-30 and day-60 floors, and version B: "reminders
    free, payments + packet paid", from "Who we win" above) before the first store submission.
    The row also carries the price step (owner, 10 Nov 2026): at about 20 real ratings the
    full plan and `dw_new_event` go from $14.99 to $19.99 by a store price change.

## What needs her

- Prices: approved 6 Nov 2026 (task 8). Her pricing model: website free with the smaller
  plan; the app freemium, one flat fee paid once, bundles on top.
- Apple ($99/yr) and Google Play accounts under the company after the D-U-N-S number, and
  RevenueCat with the three products: she creates them herself. Codex needs none of these
  to build or preview.
- Her yes to switch the AI draft on for the live hosts (`AI_DRAFT_ENABLED`); until then the
  app shows the server's "switched off" message.

## Screen patterns (shipped examples first; owner, 10 Nov 2026)

These notes come from real shipped screens looked at on 10 Nov 2026 (free, no-account sources; nothing copied). They are evidence, not test results. **Where a note disagrees with a rule, a test or a ruling elsewhere in this plan (for example "rows never move", the offers order in `offersFor`, the two locked tasks per window, or any money or claims rule), the plan wins and the note is ignored on that point.** Colours, type and words come from `src/theme.ts` and this plan.

# Dream Wedding: screen patterns from shipped apps

Read this first:
- These are notes on shipped screens seen on 10 Nov 2026. They are not test results. Nobody measured which layout sells more.
- SEEN = I looked at the screenshot. TEXT ONLY = I read a description and did not see it.
- Sources: Adapty paywall library (a paywall capture per app) and App Store web pages (store screenshots, which are marketing frames around real screens).
- Structure only. No competitor words, colours or art are to be reused.


### (c) One-time-purchase paywall, two offers (bundle first, then single)

Examples looked at:
- Structured, "lifetime only" variant: https://adapty.io/paywall-library/structured/ : one-time ($4.99 once), one offer. SEEN
- Structured, three-plan variant (same page): monthly, yearly, lifetime rows : mixed; lifetime row is one-time. SEEN
- Up Ahead: https://adapty.io/paywall-library/up-ahead-countdown-widgets/ : mixed; monthly, yearly, then a separate lifetime row. SEEN
- Subscription Manager: https://adapty.io/paywall-library/subscription-manager/ : one-time, two price tiers side by side. SEEN
- Packing List Checklist: https://adapty.io/paywall-library/packing-list-checklist/ : one-time, one offer. SEEN
- Bills Organizer & Reminder: https://adapty.io/paywall-library/bills-organizer-reminder/ : two separate one-time unlocks stacked. SEEN
- Tripsy: https://adapty.io/paywall-library/tripsy/ : mixed; yearly, monthly, lifetime rows. SEEN
- Wedding Seating Chart Planner: https://adapty.io/paywall-library/wedding-seating-chart-planner/ : SUBSCRIPTION (free week, annual and monthly). SEEN, used only as a contrast.
- Wedding apps that sell once, seen on the store price list only (their paywall screen was not visible): Wedding Planner: Harmony ($29.99 premium, $19.99 discount) https://apps.apple.com/us/app/id6756780549 ; Marrigo (lifetime $39.99 beside monthly and yearly) https://apps.apple.com/us/app/id6769004240 ; MyWed ("Premium for Wedding" items beside monthly plans) https://apps.apple.com/us/app/id1475606210 . TEXT ONLY for the paywall layout.

What they share:
- One screen, no scrolling needed to reach the button. Order is: short title, a list of 4 to 7 things you get (icon or tick plus a few words each), the offers, one main button, small links.
- Every one-time screen says in plain words that it is paid once. The phrase sits next to the price, not in the small print.
- Each offer is one row or card: name on the left, price on the right, one short line under it. Two or three offers at most.
- When there is more than one offer, one is already selected and outlined. Only one carries a small label.
- One filled main button at the bottom. "Restore purchase" is a small text link. A close or cancel control is in a top corner and is visible straight away.
- The one-time screens are shorter than the subscription ones: no trial wording, no renewal paragraph.

Build it like this:
- Top bar: a visible close (X or "Not now") in a corner. Nothing else.
- Title: one line saying what unlocks. Under it one line that says it is paid once for this wedding and is not a subscription.
- What you get: 4 rows in the selling order (payments and final-payment schedule, wedding-week sheet, printable hand-over packet, partner on a second phone). One icon and under 8 words per row.
- Offers: two cards stacked. Bundle card first, already selected, with the one small label and one line saying what it adds (the printables). Single "full plan" card second. Name left, price right, same type size on both.
- Main button: one, full width, under the cards. Its wording follows the selected card and includes the price (kind: "Get the <selected offer>, $X once").
- Under the button: "Restore purchase" as a text link, then terms and privacy links. Nothing more.
- Leave out: monthly or yearly rows, trial wording, a toggle, a comparison table, a carousel, reviews, a second button.

Do not:
- Do not use a countdown timer, a struck-through "was" price that was never charged, or "only N left".
- Do not hide, delay or shrink the close control, and do not pre-select anything beyond the one visible offer card.
- Do not show more than two offers. No shipped one-time screen seen here used more than three rows, and those with three were mixing in subscriptions.

Honest limits: 7 paywalls seen; 5 sell once or include a pay-once row. Only 2 show exactly two pay-once offers on one screen (Subscription Manager, Bills Organizer & Reminder). None is a wedding app with a bundle plus single layout; that exact pairing was not found.

### (a) Welcome / "when is the wedding?" first screen

Examples looked at (none shows the date-entry screen itself; each shows the first screen the date produces):
- The Knot: https://apps.apple.com/us/app/id457941553 : free, no in-app price list shown. SEEN (home only)
- Zola: https://apps.apple.com/us/app/id852691916 : free with one-time add-ons. SEEN (home only)
- WeddingWire: https://apps.apple.com/us/app/id316565575 : free. SEEN (home only)
- Wedding Planner: Harmony: https://apps.apple.com/us/app/id6756780549 : one-time. SEEN (home only)
- Marrigo: https://apps.apple.com/us/app/id6769004240 : mixed, has lifetime. SEEN (home only)
- MyWed: https://apps.apple.com/us/app/id1475606210 : mixed. SEEN (home only); its store text says tasks are generated from the wedding date. TEXT ONLY for that claim.

What they share:
- Every app's first real screen is built from two inputs only: the wedding date and the couple's names. Nothing else is needed to draw it.
- The date comes back at once as a big "N days to go" number at the top of the home screen, with the names and the date in small type under it.
- The next thing under the countdown is the plan or task summary, not a feature tour.
- No store page shows a sign-in screen as its first frame.

Build it like this:
- One question on the screen: the wedding date. A native date picker, set to a sensible future default.
- One line above it saying what the date is used for (it builds the dated plan).
- One main button at the bottom (kind: "Build my plan").
- One small text link under it for people with no date yet (kind: "We have not picked a date"). It should still build a plan from an estimated date they can change.
- Names are optional and can be asked on the same screen as two small fields, or later. Do not make them required.
- The very next screen is the plan with the countdown at the top. No tour, no paywall, no account screen in between.
- Leave out: email field, sign-in, budget question, guest-count question, notification prompt, feature carousel.

Do not:
- Do not ask for anything the plan does not need to draw its first view.
- Do not show the paywall before the person has seen their own dated plan.

Honest limits: 0 date-entry screens were seen. Store pages do not show onboarding, and the libraries that do (Mobbin, Page Flows) need an account, so they were not used. These notes are inferred from 6 home screens. Treat this block as the weakest in the file.

### (b) Plan screen, first view (dated checklist with a "do these next" card)

Examples looked at:
- The Knot: https://apps.apple.com/us/app/id457941553 : free. SEEN
- Wedding Planner: Harmony: https://apps.apple.com/us/app/id6756780549 : one-time. SEEN
- MyWed: https://apps.apple.com/us/app/id1475606210 : mixed. SEEN
- Marrigo: https://apps.apple.com/us/app/id6769004240 : mixed, has lifetime. SEEN
- Wedding Planner Tracker: https://apps.apple.com/us/app/id6736427896 : mixed ($44.99 one-time beside monthly and annual). SEEN
- Wedding Planner (Sevenlogics): https://apps.apple.com/us/app/id1236966921 : one-time ($0.99 premium). SEEN

What they share:
- Top of the screen: the countdown or a progress figure (a "done of total" count or a percent). One number, large.
- Tasks are grouped by time, not by topic first: by months-before bands (The Knot: 4 numbered stages), by month tabs (MyWed, Sevenlogics "This Month"), or by Overdue / Upcoming / Later (Harmony, Marrigo filter chips).
- Each task row is: a round tick box on the left, the task name, and one small line under it with category and due date.
- Overdue tasks sit first and are marked in a warning colour. Done tasks are struck through and stay visible.
- Two apps put a short "what needs attention next" block above the full list (Wedding Planner Tracker "tasks coming up" with one button; Marrigo one alert row on Home).
- A small round "+" to add a task sits in a top or bottom corner. It is never the main thing on the screen.

Build it like this:
- Top: countdown line ("N days to go", date under it) and one progress figure ("9 of 18 done").
- Next: the "do these next" card. 3 tasks only, each with a tick box and due date. One text link at the bottom of the card to see the whole list.
- Under the card: the full list in time bands, newest band open, later bands collapsed. Band header shows its name and a count.
- Task row: tick box left, name, one small line (category, due date). Tap the box to tick; tap the row to open.
- Overdue: one band at the very top, only when it has items.
- Paid items appear in the list as normal rows with a small lock, in their real place by date. Tapping one opens the paywall.
- Leave out: charts, four-tile dashboards, vendor ads, tips feed, a banner selling the upgrade above the tasks.

Do not:
- Do not show the whole list ungrouped. Every app seen groups by time.
- Do not put more than 3 items in the "do these next" card.
- Do not hide ticked tasks by default.

Honest limits: 6 seen. Only 2 of the 6 have a clear "next" block above the list, so the card is a less common pattern than the time-banded list.

### (d) Payments / bills schedule (who is paid, amount, due date, paid or not, total left)

Examples looked at:
- Chronicle (bills): https://apps.apple.com/us/app/id572561420 : store lists one "Chronicle Pro $14.99" item; the Adapty capture shows a $9.99 yearly subscription, so treat as mixed. SEEN
- Bills Manager: https://apps.apple.com/us/app/id834370671 : one-time ($5.99 remove ads). SEEN
- MyWed, Budget and Vendors screens: https://apps.apple.com/us/app/id1475606210 : mixed. SEEN
- Wedding Planner: Harmony, Budget: https://apps.apple.com/us/app/id6756780549 : one-time. SEEN
- WeddingWire, Budget: https://apps.apple.com/us/app/id316565575 : free. SEEN
- Wedding Planner Tracker, Budget: https://apps.apple.com/us/app/id6736427896 : mixed. SEEN

What they share:
- A summary block at the top with 2 or 3 money figures and nothing else: total, paid, and left to pay (worded as unpaid, pending, awaiting payment or remaining).
- Under it, one row per payee. Left side: who is paid, with a small second line. Right side: the amount, right-aligned, with the due date under or beside it.
- The two bill apps group rows by urgency, each group with its own subtotal in the header: past due, due soon (within 7 days), due later, paid.
- Paid or not is one control per row: a tick box on the row (Bills Manager) or a "log payment" button on the detail screen (Chronicle). Paid rows move to a Paid group and stay visible.
- Wedding apps show paid and still-owed as two small figures on each row (deposit paid, balance pending), because a vendor is paid in parts.
- Past-due amounts are the only thing in a warning colour.

Build it like this:
- Top summary: three figures in one block: total agreed, paid so far, left to pay. "Left to pay" is the largest.
- Under it, one line: the next payment (who, how much, when).
- List grouped by due date with a subtotal in each header: Past due (only if any), Due in the next 30 days, Later, Paid.
- Row: payee name left with a small line under it (what the payment is: deposit, second payment, final payment). Amount right-aligned, due date under the amount. A tick box at the far right marks it paid.
- Ticking a row moves it to Paid, updates the three top figures at once, and offers undo.
- One "+" to add a payment. A vendor paid in parts is several rows under one vendor name, not one row with a formula.
- Leave out: pie charts, category percentages, typical-cost advice, bank linking, calendar grid on this screen.

Do not:
- Do not show only a total budget without the per-payment due dates; the dated rows are what this screen is for.
- Do not delete or hide paid rows.
- Do not colour anything red except past-due amounts.

Honest limits: 6 seen. The 2 bill apps show the due-date grouping; the 4 wedding apps show budget by category and do not group by due date. A wedding app with a true final-payment schedule screen was not found.

### (e) Traditions tab (optional packs: a list, what a pack adds, add it, remove it)

Examples looked at on 11 Nov 2026 (each opened; phone-width captures of public pages and store screenshots):
- PackPoint: https://apps.apple.com/us/app/id896337401 : free app. Store screenshots show the pack picker and the list it produces. SEEN
- Productive, habit tracker: https://apps.apple.com/us/app/id983826477 : free app with paid extras. Store screenshots show a "pick a ready-made set" list and a programs list. SEEN
- Todoist, wedding planning template page: https://www.todoist.com/templates/wedding-planning : public page, one ready-made list. SEEN (the page itself; copying the list into an account was not tried)
- Riwaya wedding planner: https://riwaya.riwaya.co.uk/online-muslim-wedding-planner : public product page with two screenshots of the planner (choosing a cultural preset, and one tradition's tasks). SEEN (the two screenshots on the page; the planner itself sits behind a sign-up and was not opened)

What they share:
1. The packs are one plain list or grid on their own screen, reached from the plan, never forced on the way in. Each pack is one row or tile: its name and at most one short line. No prices and no long text in the list.
2. A pack that is already in use is marked in place (a tick on the tile in PackPoint, an outline and progress line on the current programme in Productive). The others carry one small button or nothing.
3. Tapping a pack shows what it is before anything changes: a title, a few sentences, and one main button that adds it (Todoist: a preview button and a copy button; Riwaya: one plain sentence explaining the tradition above its tasks).
4. Added items land in the normal list, grouped under the pack's name with a small count (PackPoint: a header per activity with "1 of 12"), and look like every other row: a tick box and the item.
5. Added items can be changed or taken out one by one (Riwaya: a small x on each task and an "add a task" row under them; PackPoint: a customise button).
6. There is always a way to skip packs and write your own (Productive: a "create your own" button under the list).

Build it like this (top to bottom, 390 px wide):
1. Title, then one line: these are optional, and a pack adds its tasks to your plan in the right time windows.
2. Seven rows, one per pack, in the order the data files list them. Each row: pack name, then its one free example task in small type under the name. A row whose pack is already in the plan shows a small "Added" mark on the right instead of the arrow.
3. Tap a row to open that pack. Top: pack name and a back control. Next: one or two plain sentences on what the pack covers. Next: the free example task shown in full, with its time window and its source link.
4. Under the example, one line saying the rest of the pack comes with the full plan. Before purchase the phone holds only the name and the example, so show no task names, no count and no blurred rows for the rest.
5. One main button at the bottom, full width.
   - Without the full plan: it adds the one free example task to her plan, and a text link under it opens the paywall (pattern c).
   - With the full plan: "Add to my plan" merges every task in the pack into her plan, each in its own window and marked with the pack's name. Tapping it a second time adds nothing.
6. After adding, stay on the pack screen: the button becomes a quiet "Added" state, with one text link to see the tasks in the plan and one text link "Remove this pack".
7. Remove asks once, in plain words, and says what stays: tasks she has ticked or edited are kept, the untouched ones go. Offer undo.
8. In the plan itself, pack tasks are normal rows in their real place by date with a small pack label. They do not get their own tab or colour.

Never:
- Never let several packs be ticked at once and added in one go, as the PackPoint grid does. One pack is read, then added.
- Never ask for an account, an email or a cultural question at setup to reach the packs. Riwaya picks the preset during sign-up; this plan forbids that (no account, no email to see or use the plan).
- Never put paid pack content in the app before purchase, and never fake it with blurred or greyed rows. PackPoint and Todoist give the whole list free; the plan rule wins here: name and one example free, the full pack only after a confirmed purchase.
- Never type a task count. A count is shown only when it is read from a pack the phone actually holds.
- Never use joined counters, timers or "start" pressure as the Productive challenge cards do (brand do-not list).
- Never describe a tradition in a way the pack's sources do not support, and never drop the source link from a task.

Honest limits: 4 seen. None of the four sells part of a pack and gives one sample free; that split comes from this plan, not from an example. None shows a "remove the whole pack" control; Riwaya shows removal task by task only. Riwaya is two marketing screenshots, not the live planner. No wedding app with a tradition-pack picker was visible on a store page.

### (f) The AI draft (short form, consent before sending, the one email, review before applying)

Examples looked at on 11 Nov 2026 (each opened; phone-width captures of public pages):
- AIFreeForever wedding vow generator: https://aifreeforever.com/tools/ai-wedding-vow-generator : free, no account. The form itself. SEEN
- Mistral Le Chat, first visit: https://chat.mistral.ai/chat : no account needed to reach the screen. An accept step that blocks the AI until it is agreed. SEEN
- Duck.ai, first visit: https://duck.ai/ : free, no account. Consent given by a line of small print under the box. SEEN, used as a contrast.
- WooCommerce Memberships help page, checkout opt-in screenshot: https://woocommerce.com/document/mailchimp-for-woocommerce/ : the email field with a separate optional box under it. SEEN (the screenshot on the vendor's help page)
- Hitched sign-up form: https://www.hitched.co.uk/users-signup.php : free wedding site. Email inside an account form with one agreement box. SEEN, used as a contrast.
- Day One, AI features guide: https://dayoneapp.com/guides/labs/ai-features/ : the vendor's help page says a privacy notice appears the first time an AI feature is tapped, with one agree button, and that it can be switched off later in settings. TEXT ONLY (the page has no picture of the notice).

What they share:
1. The form is one screen with a handful of fields (the vow form: two pick-lists, one required text box, two optional fields, one more pick-list). Required fields are marked; optional ones say so in the label.
2. The main button sits straight under the last field and looks switched off until the required fields are filled.
3. Where the AI step is gated, the gate is its own small block: a short title, one sentence with links to the terms and privacy pages, and one button. Nothing behind it can be used until it is accepted (Le Chat; Day One by its own description).
4. The weaker pattern is consent by small print: one grey line under the box saying that pressing the button means you agree (Duck.ai). No tick, no separate step.
5. A marketing choice done properly is a single tick box directly under the email field, unticked, with the word "optional" in its label, and the form sends without it (WooCommerce screenshot).
6. The contrast: Hitched puts the email inside a full account form (name, password, role, date, town) with one agreement box that appears already ticked and no separate marketing choice.

Build it like this (top to bottom, 390 px wide):
1. Title, then one line: what the draft is (a first version of her plan written by a free AI model, which she checks before anything changes).
2. The wedding fields: only the ones `/api/ai-draft` accepts, each with a plain label above it, pick-lists where the answer is one of a few choices. Optional fields say "optional" in the label. No field asks for anything the draft does not use.
3. Email field, with one line under it saying this is the only place the app asks for it and what it is used for.
4. Marketing box directly under the email: unticked, labelled optional, her own words for what she would receive. The form works the same with it left empty. `marketing` is sent as true only when she ticks it.
5. Consent box, set apart from the marketing box by space or a rule: unticked, required. Its label says in plain words what is sent (the answers above), where (a free AI model, outside the app) and that nothing is sent until she ticks it. Link to the privacy page beside it.
6. Main button, full width, under the consent box. It stays off until the required fields are filled and the consent box is ticked. Pressing it is the first moment anything leaves the phone.
7. While waiting: the button shows it is working and the fields stay as she typed them.
8. If the server answers with a message (switched off, busy, already used, too many from this connection, daily limit), show the server's sentence word for word in a plain block above the button. Her answers stay on screen. No extra wording from the app.
9. If a draft comes back: a review screen. Top line says nothing has changed yet. Then the planning fields returned by `/api/ai-draft` (date, guests, locations, season, budget, budget mode, priorities and notes), each with a tick so she can leave any out. The API returns fields, not tasks. Two buttons at the bottom: one saves the selected details, one discards the draft. Her saved plan is touched only by the first button.
10. After saving: show the saved planning details and one undo; an accepted wedding date updates the dated plan. Existing tasks and ticks stay intact.

Never:
- Never pre-tick either box. Hitched's agreement box appears already ticked; that is forbidden here.
- Never fold consent into small print under the button, as Duck.ai does. Apple guideline 5.1.2 and this plan need a clear yes before personal details go to an AI model, so it is a tick she makes herself.
- Never join the consent box and the marketing box into one tick, and never make the marketing box required.
- Never ask for a password, a name, a town or an account, as the Hitched form does. The email is the only personal field, and it is asked on this screen only.
- Never send anything, including the email, before the consent box is ticked and the button is pressed.
- Never reword, shorten or decorate the server's messages, and never show an app-made error in their place.
- Never apply a draft to her saved plan without the review step, and never replace her existing tasks or ticks with it.
- Never put a model address or key in the app, and never name a model the server did not name.

Honest limits: 5 seen, 1 read. Only the Le Chat screen shows a real consent step before an AI model, and it is an accept button, not a tick box; no shipped screen with an unticked AI consent box inside a form was found on a free, no-account source. No example shows a review step before a draft is applied, or server messages shown word for word; both come from this plan's rules, not from an example. The email with an optional box is one help-page screenshot of a web checkout, not a phone app. Hitched's box looked ticked in a single capture; it was not clicked to check.

### (g) Wedding-week sheet and (h) hand-over packet: no outside examples needed (coordinator, 11 Nov 2026)

The shipped-examples rule covers the first screen, onboarding, the paywall, the main list and payments.
Tasks 8b and 8c are neither: one is a second view of lists already patterned, the other is paper. So
there is no NAMED STOP [PATTERN_NOTES_MISSING] for them. Build them from what is already here:
- **8b, wedding-week sheet:** the same rows as the plan screen (pattern b), grouped under day headings
  ("7 days before" down to "Wedding day") instead of windows. Under the tasks, two plain sections:
  "Who to call" (one row per vendor: name, phone, arrival time, who calls if late; add and edit like a
  payment row in pattern d) and "Envelopes" (the payment rows due this week, read from Payments, not
  typed twice). No new tab: it opens from the plan screen and from More.
- **8c, hand-over packet:** copy the structure of the website's printable packet (the planner's
  "Print my plan" page on main): names and date on top, tasks by window with a tick box, date, owner
  and a "Who" blank, then payments, then the wedding-week sheet and contacts. Black on white, no
  colour blocks, nothing that needs a colour printer. One main button, "Print or send my plan", which
  opens the phone's share sheet.
- Never: a new tab, a typed date, a count that is not read from the list the phone holds, or any paid
  task in the free packet.

# Dream Wedding: screen patterns from shipped apps (additions, 11 Nov 2026)

Read this first:
- Notes on shipped screens looked at on 11 Nov 2026. Not test results. Where a note disagrees with the plan, the plan wins.
- SEEN = I loaded the page and looked at the screenshot, or read the steps on the app's own help page. TEXT ONLY = I read a description and did not see the screen.
- Sources: App Store web pages (store screenshots) and the apps' own help pages. No sign-in, no trial. Structure only.

### (i) "Invite my partner", the partner's "Join this plan", sharing on, and "Stop sharing"

Examples looked at:
- Futari, wedding planner: https://apps.apple.com/us/app/id6760993827 : a "Partner Sync" sheet: icon, title, two lines of why, then two rows ("share a code" / "enter a code"), Done in the top corner. SEEN
- Packing List Checklist: https://apps.apple.com/us/app/id1235121075 : a share control and a two-people control in the list's top bar; a "My / Shared" switch on the home list; shared rows carry a two-people mark and "updated 4 min ago". SEEN
- Apple Reminders, share a list: https://support.apple.com/en-gb/guide/reminders/remnd509c0d9 : share from the list's top bar; the other person must accept; a people screen lists who is in, with "Remove access" per person and one "Stop sharing" that asks once ("Continue") and says the list leaves their devices. SEEN (help page steps, no screenshot)
- AnyList, share a list: https://help.anylist.com/articles/share-list/ : share from the list menu by typing an email; the other person must make an account with that email. SEEN (help page steps; its two images were not viewable). Used as a contrast: this is the account wall our plan forbids.
- Marrigo, wedding planner: https://apps.apple.com/us/app/id6769004240 : store text says "no account required" and partner sharing by a private link. TEXT ONLY (6 store screenshots looked at; none shows the sharing screen)
- WePlan Wedding: https://apps.apple.com/us/app/id6762328579 : store text says one private invite link, but the partner signs in. TEXT ONLY (6 screenshots looked at; none shows it)
- tricount: https://apps.apple.com/us/app/id349866256 : said to let people join by link with no sign-up. TEXT ONLY (search summary only; its help pages returned 404 and its 8 store screenshots show no share screen)

What they have in common:
- Sharing is reached from the plan itself (a top-bar control or a row in settings), never forced during setup.
- The invite screen is short: one line of why, then one action that hands off to the phone's own share sheet. The sender types nothing about the partner.
- The joining side has one job: accept. Where an account is asked for (AnyList, WePlan), it is the only extra step, and it is the step to leave out.
- Sharing on is shown quietly in place: a two-people mark and a "last updated" time. No banner.
- Stopping is on the same screen as inviting, asks once, and says plainly what the other person loses.

For our screen (top to bottom):
1. Invite (her phone, owner of the full plan). Title "Invite my partner". One line: both phones show the same plan; no account; nothing more to pay. One line on privacy: anyone with the link can open the plan, so send it only to your partner. One main button, full width, at the bottom: "Send the link" (opens the share sheet). Nothing else to choose.
2. After sending: same screen, now "Sharing is on". Shows "Link sent" and, once the partner has opened it, "Your partner joined" with the last-updated time. A text link "Send the link again". A text link "Stop sharing" at the bottom, apart from the rest.
3. Join (partner's phone, opened from the link). Title "Join this plan". The event's name (locked, read-only) and the wedding date. One line: you will see the same tasks and payments; ticks show on both phones. One main button: "Join this plan". A small "Not now". No email, no name, no account, no price.
4. Joined state: the plan opens fully unlocked. A two-people mark in the plan's top bar; tapping it shows "Shared with you" and "Leave this plan".
5. Stop sharing (her phone): asks once. Says what happens: your partner's phone goes back to the free plan; nothing is removed from yours. Two buttons: "Stop sharing" and "Keep sharing". After: the screen returns to state 1 and the old link no longer opens the plan.
6. Other states: no connection (say the link needs a connection once, ticks catch up later); link no longer works (same plain sentence for a stopped link and a wrong link, with "Ask your partner for a new link"); she does not own the full plan (the row opens the paywall, pattern c, not this screen).

Must NOT be there:
- No account, email, phone number or code to type. No second purchase or price on the partner's side.
- No "invite family / friends" list, roles or permissions. One partner, one link.
- No pressure wording, no badge count nagging her to invite, no pre-sent messages.
- No mention of this screen anywhere until task 7 ships (plan rule).

Honest limits: 4 seen, 3 text only. Only Futari shows a wedding partner-invite screen, and it uses a typed code, not a link. No example seen joins by link with no account AND unlocks paid content on the second phone; that part comes from the plan, not from an example.

### (e) Traditions tab: already covered, small additions only

The plan already has this pattern: section "(e) Traditions tab" in `docs/APP_PLAN.md` (4 examples seen on 11 Nov: PackPoint, Productive, Todoist template, Riwaya). It covers the list of seven rows, the pack screen, add, the "Added" state, remove with undo, and the locked split (name plus one free example; no blurred rows). Nothing there needs changing.

Extra examples looked at for the gaps:
- Packr: https://apps.apple.com/us/app/id1208312901 : a grid of optional lists grouped under three headings; chosen tiles are coloured, the rest grey; one button under the grid; the result is a list grouped by pack with "4/17 items" counts. SEEN
- Packing List Checklist: https://apps.apple.com/us/app/id1235121075 : "pick items from another list" as one button under the list; no pack picker shown. SEEN

What they have in common (adds to (e), does not replace it):
- A chosen pack is told apart by one mark only (colour or tick). No shipped picker seen puts a lock, a price or a "premium" label on each row.
- Seven rows fit one screen; headings and groups are only used at 30 or more.

For our screen (only what (e) does not already say):
- Nothing added yet: the seven rows and the one intro line. No empty-state picture, no "start here" prompt.
- All seven added: every row shows "Added"; the screen stays the same otherwise.
- Locked mark: none on the rows. The paid line appears once, on the pack screen, as (e) step 4 says. This keeps the list calm and matches every example seen.
- Partner's phone while joined (pattern i): packs she added show "Added"; add and remove work the same. After sharing stops, the joined phone shows the free view again.
- Sales switched off (`DW_STORE_NOT_SET_UP`): the text link to the paywall is hidden; the free example still adds.
- Must NOT be there: a multi-select grid with one "add all" button (Packr does this; (e) already forbids it), a lock on every row, a typed task count.

Honest limits: 2 more seen (6 in all with (e)). No example seen marks some packs as paid inside the picker, so "no lock on the rows" is a judgement from their absence, not from a tested screen.
