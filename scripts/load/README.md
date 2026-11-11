# App target-day check

`npm run load:app-day` replays 3,000 shared-plan opens and 1,000 ciphertext writes
against `/api/plan-share` on an isolated Worker preview. It checks every response,
content and revision, deletes its share, then confirms that the deleted id is gone.
The synthetic payload contains no real plan or paid content. The initial create is
one of the 1,000 writes; cleanup adds one delete and one read.

Use the **App target-day preview load** workflow on the branch being checked, with
an isolated `https://…workers.dev` origin. Apply migration 0009 and enable sharing
on that preview only, using an isolated database with unused daily capacity. Do not
use a production Worker or a preview bound to production storage. The runner never
sets forwarding headers, changes deployment settings or calls a model or store.

The replay takes about 37 minutes: 550 ms between requests keeps the one CI caller
below 120 requests/minute. Each request has a ten-second deadline; redirects are
refused. The workflow stops after 45 minutes. Failed requests, corrupt responses,
failed cleanup and missing configuration exit nonzero with
`NAMED STOP [APP_DAY_LOAD_FAILED]`. An interrupted job can leave synthetic
ciphertext; the normal 90-day share expiry and retention sweep still apply.

`tests/unit/app-day-load.test.ts` runs the same full replay against the real handler
and SQLite with a virtual clock, and proves corrupted reads fail and cleanup runs.
This is correctness and volume coverage, not evidence of deployed latency or UI
rendering. Phone plans are built locally and need no server request; these opens
exercise the shared-plan download path. The existing `npm run load:ai-draft` checks
3,000 drafts with model providers mocked and verifies the $0 ceilings separately.
A passing local replay does not count as a passing deployed preview run.
