# App Store listing: text for the NEXT Apple version (not 1.0)

**Status: READY, NOT SUBMITTED (21 Nov 2026).** Paste into App Store Connect (Dream Wedding, app
6834891267, en-US) with the next version after 1.0 clears review. Nothing here has been sent to Apple.
English only: the app ships no other language, so there is no Spanish listing to write.

## Why the first lines changed

AI answers to "best wedding planner app" and similar questions are built mostly from
`apps.apple.com` listings (growth research, 21 Nov 2026). The first paragraph now answers the
buyer's three questions in plain words an answer engine can quote: what it does (a wedding
checklist dated to your day), who it is for (couples planning their own wedding without a paid
planner) and the price model (free, no account; the full plan is one payment per wedding, never a
subscription). No dollar amount is written, so the text stays true when the store price changes
(the planned rise to $19.99 at about 20 ratings is her call, made in the store).

## Every promise, and where it is built (ship-ready check 13)

| Line | Built in |
|---|---|
| Checklist dated to your day, now / next / catch up | `app/(tabs)/plan/index.tsx` (`planBlocks`, `catchUpRows` in `src/planTasks.ts`) |
| No account, no email; no vendor ads; we never sell your plan | `src/firstScreen.ts` `NO_ACCOUNT_LINE`; `docs/app-privacy.md` |
| One payment per wedding, never a subscription | `src/billing` (one-time products only; `dw_new_event` for a new wedding) |
| Free copy of your dated tasks to print or send | `app/(tabs)/more/packet.tsx` |
| Full-plan list (payments, wedding week, packet, all tasks, reminders, traditions) | unchanged from 1.0 as published |
| AI planner, three answers a day, then fixed lists | unchanged from 1.0 as published |

The partner-on-a-second-phone line stays out: store builds have sharing switched off
(`src/sharingSwitch.ts`). Bring it back only in the version whose store build sets
`EXPO_PUBLIC_DW_SHARING=1` (its deadline is in the spry brain, 28 Feb 2027).

## Promotional text (≤ 170)

Engaged? Get a wedding checklist dated to your day in a minute. Free, with no account. The full plan is one payment, never a subscription.

## Description (≤ 4000) — 2119 characters

Dream Wedding Builder is a wedding planner app for couples planning their own wedding without paying a wedding planner. Give your wedding date and get a wedding checklist dated to your day: what to do now, what comes next, and what to catch up on if your date is close. Free to download and use with no account and no email. The full plan is one payment per wedding, never a subscription.

Not sure what you want yet? Start there.

Say what you picture in a sentence, add photos you love, or tap "I don't know yet" and choose a season, a setting and a mood. Dream Wedding Builder shows you your wedding on one page: the look and feel, your colours, the kinds of venues that carry it, ideas to match, and what to ask. Keep the parts you love.

Then give your date. Everything you kept goes into your plan, worked back from your day. Tick tasks off and add your own.

Free: your wedding on one page, your dated plan, ticks and your own tasks, and a copy of your dated tasks to print or send. No account and no password; your plan stays on your phone. Your photos never leave your phone: only their colours and what you tapped are sent. No vendor ads, and we never sell your plan.

The full plan is one payment, no subscription:
• Your payments and final-payment schedule, dated to your day.
• Your wedding-week sheet, with who to call.
• The printable hand-over packet with payments and contacts.
• Every task from the Wedding Checklist PDF dated to your day, reminders for your dated tasks, and the common steps for your traditions (Catholic, Jewish, Hindu, Muslim nikah, Nigerian traditional, Mexican, Chinese tea ceremony).

Planner + Printables adds the printable checklist, budget, timeline and seating planners. The Day-of kit adds the day's run sheet to print.

Your wedding page is written by an AI planner, not a person: three AI answers a day, and after that it comes from our fixed lists. It never names businesses, prices or availability. Dream Wedding Builder is software. It gives general planning steps, not a human planner, vendor bookings or prices. Check details with your vendors, officiant and county.

## End of description
