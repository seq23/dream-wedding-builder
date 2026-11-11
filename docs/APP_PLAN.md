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
7. **Two phones.** Site PR: `/api/plan-share` on the Worker (app-security shape: 64 KB
   cap, per-IP limit via lib/abuse-limits, a daily ceiling, additive migration, stores
   only ciphertext under a random id). App PR: encrypt with the key in the link fragment
   (@noble/ciphers, as KeepMyProof); merge ticks by latest stamp.
   Tests: over 64 KB → 413; over the limit → 429; an unknown id and a wrong key answer the
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
