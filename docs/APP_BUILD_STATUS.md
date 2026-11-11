# App build queue — 10 Nov 2026

Task 1 PR prepared against the scaffold branch; coordinator reviews and merges.
Next task: 2, after task 1 lands. Tasks are grouped into PRs by risk (owner, 10 Nov 2026 evening); see the queue brief. Task 1a (a hosted preview link) comes before task 2; tasks 8a to 8c (payments, wedding week, packet) were added to the plan on 10 Nov.

Preview: CI exports the app for the web and puts a free download shortcut in its
run summary. Download, unzip and serve with `python3 -m http.server 8080`.
No Appetize uploads or minutes. This is a downloadable preview, not hosted hosting.

NAMED STOP [WAITS_FOR_LAUNCH_PLAN]: tasks 10 (store files) and 12 (website line) wait for the owner's launch plan after 13 Nov. Release gates remain in scope.

Task 1a: CI publishes a noindex Cloudflare Pages web preview and posts its link in the summary and PR. Missing credentials, refused deploys and missing URLs fail with NAMED STOP [PREVIEW_HOST_FAILED]. Next: task 3, after the open task 2 PR is reviewed.
