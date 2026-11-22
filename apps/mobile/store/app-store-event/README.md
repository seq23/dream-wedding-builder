# January engagement season: Apple In-App Event + featuring nomination (DRAFT, NOT SUBMITTED)

**Status: DRAFT (21 Nov 2026).** Not entered in App Store Connect. Events and nominations show
publicly once entered, so enter them only after Dream Wedding 1.0 is live. The coordinator takes
this to her first.

Why January: engagements peak at Christmas and New Year, and the searches that start planning peak
in January ("wedding guest list template" 4,400 in Jan 2025 and 2,900 in Jan 2026; "questions to
ask wedding venue" 5,400 in Jan 2022; growth research `RESEARCH.md` §3, 21 Nov 2026).

## In-App Event (App Store Connect → Dream Wedding → In-App Events)

Apple shows an event on the product page, in search and in editorial when it is a real, timely thing
to do inside the app. This one is the app's first step done at the moment it matters most: a newly
engaged couple gives a date and gets the first 12 months planned. Everything it names is in the free
app today, so nothing is promised that is not built.

| Field | Text | Limit |
|---|---|---|
| Reference name | DW January engagement season 2027 | internal |
| Event name | Just Engaged? Start Your Plan | 30 (29) |
| Short description | Your wedding tasks, dated from your day | 50 (39) |
| Long description | Engaged over the holidays? Give your date and see what to book first. Free, with no account or email. | 120 (101) |
| Badge | Special Event | |
| Purpose | Appropriate for all users | |
| Priority | Normal | |
| Event deep link | the free journey (`/feel`, the first screen of a fresh install; an existing plan opens `/plan`) | |
| Event start | 26 Dec 2026, 00:00 local | |
| Event end | 31 Jan 2027, 23:59 local | |
| Publish (shows as "upcoming") | 19 Dec 2026 (Apple allows up to 14 days before the start) | |
| Countries | every country the app is offered in (not China mainland, spry ruling 16 Nov 2026) | |
| Event card media (16:9) | `event-card.png` 1920 × 1080 | |
| Event details media (9:16) | `event-details.png` 1080 × 1920 | |

The art carries no words except the plan's real tabs (12+ months, 9 months, 6 months, Wedding week),
with "12+ months" active; the lower third is left clear for the name and description Apple draws over
it. Sources: `event-card.html`, `event-details.html` (render with headless Chrome at the stated size
and scale 1).

Every line is true today: the first screen (`app/feel.tsx`) starts the free journey; the dated plan
(`app/(tabs)/plan/index.tsx`) shows what to do now and next from the date; "no account or email" is
`NO_ACCOUNT_LINE` in `src/firstScreen.ts`. No price is named.

Risk, and version B: Apple can refuse an event that reads as an ad for the app's normal use. If it is
refused, version B is a **Major Update** event for the first update that ships in January (its own
new feature named in the event), with the same dates and art.

## Featuring nomination (App Store Connect → Featuring → Nominations)

| Field | Text |
|---|---|
| Type | App Launch |
| Name | Dream Wedding Builder: a wedding checklist dated to your day |
| Publish date | the day 1.0 goes live |
| Countries | United States, United Kingdom, Canada, Australia |
| Description (what is new, who it is for, why now) | Dream Wedding Builder is for couples planning their own wedding without paying a planner. Say what you picture in a sentence or with photos, or tap "I don't know yet", and see your wedding on one page; then give your date and every task is dated from your day, with what to do now and what to catch up on. It is free with no account or email, the plan stays on the phone, and the full plan (payments, the wedding-week sheet, a printable hand-over packet and steps for seven traditions) is one payment per wedding, never a subscription. It launches into the January engagement season, when newly engaged couples start planning. |
| Supporting material | the App Store screenshots and the In-App Event above |

Nothing in the nomination is an outcome claim (no rankings, ratings or user counts).
