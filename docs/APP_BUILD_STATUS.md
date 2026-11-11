# App build queue — 10 Nov 2026

Task 1 is merged. Task 2 is implemented in open PR #134 and included as a dependency here.
Task 1a publishes the web export to the free Cloudflare Pages preview project, with a
noindex header and a link in the CI summary and PR. Missing credentials, refused deploys
and missing URLs fail with NAMED STOP [PREVIEW_HOST_FAILED]. No Appetize use.

Task 3 is implemented: the preview-only welcome shortcut saves the sample date, two ticks and one own task. Next task: 4 (reminders), alone. Tasks 8a to 8c (payments, wedding week, packet) are in the fresh plan.
Coordinator reviews and lands the PRs; agents never merge.

NAMED STOP [WAITS_FOR_LAUNCH_PLAN]: tasks 10 (store files) and 12 (website line)
wait for the owner's launch plan after 13 Nov. Release gates remain in scope.

Task 4: local reminders implemented in its own PR, based on open PR #136
(tasks 1a, 2, 3, including #134). Future window starts and wedding day use 9:00
local time. Ticks, own-task edits and date saves replace the schedule. Permission
and event entitlement are checked before scheduling; remindersNeedFullPlan supports
version B. Not now is saved and More exposes the settings again.
The entitlement adapter returns false until task 8 wires verified event access;
no preview flag grants paid access and no notification permission is requested free.
Native delivery still needs a device check; no Appetize minutes were used.
Next task: 5 (tradition packs), alone.

NAMED STOP [PATTERN_NOTES_MISSING] welcome/date, plan first view, full-plan paywall,
Payments. No Screen patterns section exists in the current scaffold plan. Existing
first views were not redesigned; task 4 adds scheduler plumbing and reminder settings.
Tasks 8 and 8a wait for their pattern notes.
