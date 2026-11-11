# App build queue — 10 Nov 2026

Task 1 is merged. Task 2 is implemented in open PR #134 and included as a dependency here.
Task 1a publishes the web export to the free Cloudflare Pages preview project, with a
noindex header and a link in the CI summary and PR. Missing credentials, refused deploys
and missing URLs fail with NAMED STOP [PREVIEW_HOST_FAILED]. No Appetize use.

Task 3 is implemented: the preview-only welcome shortcut saves the sample date, two ticks and one own task. Next task: 4 (reminders), alone. Tasks 8a to 8c (payments, wedding week, packet) are in the fresh plan.
Coordinator reviews and lands the PRs; agents never merge.

NAMED STOP [WAITS_FOR_LAUNCH_PLAN]: tasks 10 (store files) and 12 (website line)
wait for the owner's launch plan after 13 Nov. Release gates remain in scope.

Review follow-up: the purchased-plan personal-task fix now keeps the original window
end date after a window expires, for both the screen and print. Regression covers
before/after expiry and the reported 20 Jan 2027 wedding. Supersedes PR #143.
Task 4 remains in open PR #139 (including its start-morning reminder regression).
Next new tasks: Dream Wedding 5; ApprovalPrep 4. Launch stops remain unchanged.

Preview fixes: web is centred at 430 px; welcome has one question, a native/web date
picker, one filled save button and small secondary links. The next card fills three
unfinished slots; completion labels show the day only. Based on the fresh scaffold,
without the open task-4 branch (#139). Next new task remains 5.

Preview follow-up: unfinished screens show plain customer text, guarded against builder
notes. No Appetize use. Next new task: 5 (tradition packs, alone).
New personal tasks now start in the window selected on the plan.
