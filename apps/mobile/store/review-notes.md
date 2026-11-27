# App Review notes (App Store Connect › App Review Information › Notes)

Paste the block below as it stands, with the 1.0 resubmission. It describes the store build, which is the
build everyone gets. `test/storeFiles.unit.ts` checks that every screen name and button quoted in it is
in the app's code, so a renamed button turns the test red before it reaches a reviewer. Google Play's
reviewer access (the review code) is in `store/play-console-answers.md` › App access. Nothing here is
sent by an agent.

Before pasting (App Store Connect, done by the owner or coordinator, never an agent):
- **In-app purchases:** attach all five to version 1.0: `dw_full_plan`, `dw_planner_printables`,
  `dw_printables_topup`, `dw_day_of_kit`, `dw_new_event`. Read from App Store Connect on 27 Nov 2026: all
  five are `READY_TO_SUBMIT`, so they are not in the current 1.0 submission, and a reviewer could not buy
  what the notes describe. US prices read the same day: $14.99, $34.99, $19.99, $9.99, $14.99, the same
  as `src/billing/offers.ts`.
- **Build:** select the new build uploaded from main (its number is on line 1 of the task sheet), not build 12.
- **Screen recording:** the one attached shows builds 8 to 11. The flows it shows (free description and
  plan, printing, Payments, the Full plan screen and Apple's purchase sheet) have the same names in the new
  build; re-record it from the new build if App Review asks.

---

1. SCREEN RECORDING
Attached in App Review Information. iOS Simulator, from launch: the free wedding description and dated plan, printing it, Payments (part of the Full plan) and the Full plan screen with Apple's purchase sheet, where it ends. All options are In-App Purchases submitted with this version. No accounts or login, and nothing one user writes is shown to another, so there is no account deletion or blocking. Plan data is erased from More > "Delete my plan from this phone".

2. AI CONTENT AND REPORTING (Guideline 1.2)
AI writes two things: the wedding description ("Your wedding, described", after step 1) and the optional draft (Plan > "Add my guests, place and budget ›" > "Fill it in from a sentence (free AI)"). Both are marked as AI. "Report this answer" under each opens a pre-filled email to info@weddingchecklistpdf.com quoting the AI text; the app stores nothing. No email app: the address is shown. Both ask first: nothing goes to AI without a tick (step 1: "Yes, send my answers to the free AI model", under a note naming the providers). Unticked, fixed lists are used.

3. PURPOSE AND AUDIENCE
Dream Wedding turns a wedding date into a checklist with a real date on every task. The dated plan, their own tasks and a printable copy are free, with no account and no email. The audience is engaged couples planning their own wedding.

4. HOW TO USE IT (no login needed)
- First screen "What should your wedding feel like?": choose "I have an idea" or "I don’t know yet", then "Continue · step 1 of 4 ›". The app describes the wedding, then "Keep what you love", then "When is it?": pick any future date and tap "Continue · step 4 of 4 ›". To skip, tap "I already know what I want. Just give me my plan ›".
- Plan tab: the dated tasks ("Do these next"), ticks, "+ Add your own task", "Print or send my plan ›" (free PDF).
- Traditions tab: optional tradition packs; one free example task each.
- Paid content (one-time In-App Purchases, no subscription): More tab > "See the full plan ›" (also from the Payments tab). Choose "Full plan" and tap "Get Full plan · <price> ›". The Full plan unlocks the Payments tab, "Your wedding week ›", the hand-over packet, every tradition pack and reminders. "Planner + printables" is the Full plan plus PDF and spreadsheet files and the Day-of kit, which open from More. Full plan owners are then offered "Printables" and "Day-of kit".
- New event: More > "Start a new event ›" sells "Full plan for a new event", button "Start my new event ›".
- Sandbox: sign in with a sandbox Apple Account to buy. Restore: on the same screen, "I already bought this: restore it ›". It restores every purchase.

5. EXTERNAL SERVICES
- Apple In-App Purchase, managed through RevenueCat (anonymous IDs, diagnostics off).
- weddingchecklistpdf.com (our own site): verifies each purchase server-side with RevenueCat and then delivers the paid task list and files; hosts the privacy, terms and disclaimer pages.
- AI (section 2): free Google Gemini or OpenRouter models, called from our server; they may use the text to improve them (step 1 says so). Emails, phone numbers, street addresses and links are removed first. Three AI answers a day; the plan never needs AI.
- Picked photos are read for colors on the phone; none is uploaded.
- Reminders are local notifications. No sign-in, ads or analytics SDK.

6. REGIONS
Same in every region where it is offered. English only; amounts typed on the Payments tab are in US dollars. Store prices are set by Apple per storefront.

7. REGULATED INDUSTRY
Not regulated; no third-party protected material. The app gives general planning steps only and names no vendors, venues, brands or prices. Tradition packs are general information with a link to each public source, and say: "Customs differ by family, faith community and place; your officiant and families have the final word."
