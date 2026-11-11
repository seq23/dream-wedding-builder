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

Screen pattern hold cleared: coordinator PR #138 merged into the scaffold during
this run; its new APP_PLAN.md is merged into this branch. Pattern notes now exist
for welcome/date, plan first view, full-plan paywall and Payments.
Next task remains 5 (tradition packs), alone.
Review follow-up: the purchased-plan personal-task fix now keeps the original window
end date after a window expires, for both the screen and print. Regression covers
before/after expiry and the reported 20 Jan 2027 wedding. Supersedes PR #143.
Task 4 remains in open PR #139 (including its start-morning reminder regression).
Next new tasks: Dream Wedding 5; ApprovalPrep 4. Launch stops remain unchanged.

PR #139 refreshed from the scaffold on 10 Nov: status conflict resolved by preserving reminder implementation notes and the purchased-plan regression record. No open dependency remains.
