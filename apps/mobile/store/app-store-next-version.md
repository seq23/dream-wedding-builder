# App Store description: change for the NEXT Apple version (not 1.0)

**Status: APPLIED (21 Nov 2026).** The partner line was removed from the Dream Wedding 1.0 (app
6834891267) en-US description in App Store Connect on 21 Nov 2026, before the build 11 resubmission.
The list below is the full-plan list as it now reads there.

## The mismatch

The published Apple description lists "Your partner on a second phone at no extra cost" among what the
full plan adds. Store builds have partner sharing switched off (`src/sharingSwitch.ts:5`:
`EXPO_PUBLIC_DW_SHARING` is not set in the EAS production environment), and the paywall lists no
second phone (`src/sharingSwitch.ts:8-10`). The listing must not promise what the app does not do.

## The change

Remove the partner line. The full-plan list in the next Apple version reads, as on the paywall and the
Play draft (`store/google-play.md`):

## Description: full plan list

The full plan is one payment, no subscription:
• Your payments and final-payment schedule, dated to your day.
• Your wedding-week sheet, with who to call.
• The printable hand-over packet with payments and contacts.
• Every task from the Wedding Checklist PDF dated to your day, reminders for your dated tasks, and the common steps for your traditions (Catholic, Jewish, Hindu, Muslim nikah, Nigerian traditional, Mexican, Chinese tea ceremony).

## End of description list

Bring a partner line back only in the version whose store build sets `EXPO_PUBLIC_DW_SHARING=1`.
"Report this answer" is on for iOS from 20 Nov 2026 (`release/README.md`).
