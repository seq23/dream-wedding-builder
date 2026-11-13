# Dream Wedding phone app — final build reconciliation, 11 Nov 2026

Reconciled against scaffold `6853569`, the coordinator's `gaps-dw.md` audit,
its additions, and the open PRs below. Build completion means every buildable
row is merged or in an open PR; it does not mean store or production readiness.
This is the one final status refresh requested by the finish list.

## Audit rows and evidence

PR numbers below are in seq23/dream-wedding-builder unless qualified.

| Audit row | Delivered by | Behavior / verification source |
|---|---|---|
| 1 Store the date | #133 | `weddingDate.unit.ts`: reopen, not set, past date, leap day |
| 1a Free hosted preview | #136, #146 | `scripts/preview/host.unit.mjs`; CI publishes a free phone web preview |
| 2 Plan and own tasks | #133, #152, #165 | `planTasks.unit.ts`, `previewPlanRows.unit.ts`: stamps, own tasks, dated locked rows, catch-up and next set |
| 3 Preview shortcut | #133, #146 | `previewPlan.unit.ts`, `releaseGate.unit.ts`: preview-only sample and store refusal |
| 4 Reminders | #139, #144, #183 | `reminders.unit.ts`; `localReminders.ts` reads verified owner or joined access |
| 5 Tradition packs | #147, #153, #172, #178, #181 | `traditionPacks.unit.ts`, `traditionView.unit.ts`: full-pack add, repeated add, removal preservation, failure and sales-off states; coordinator confirms seven private R2 uploads |
| 6 AI draft | #149, #154 | `aiDraft.unit.ts`: consent and server replies; bounded requests and manual form fallback |
| 7 Two phones | #148, #176, #180, #181, #182 | `sharing.unit.ts`, `shareSession.unit.ts`, `sharingLifecycle.unit.ts`, server `plan-share.test.ts`: fragment-key encryption, stamps, join/revoke, native response fallback, deletion, isolated event backup, minute sync |
| 8 Products and event rules | #150, #169–#174, #183–#189 | `billing.unit.ts`, `offers.unit.ts`, `eventStore.unit.ts`, `checkout.unit.ts`, `downloadStore.unit.ts`: verified checkout/Restore, locked name/date allowance, event ledger, extras, independent owner access; #189 is OPEN, green, coordinator review pending |
| 8a Payments | #151, #181, #183, #185 | `payments.unit.ts`, `paymentDatePicker.unit.ts`, `downloadStore.unit.ts`: delivered list, persisted drafts, dates and totals |
| 8b Wedding week | #161, #181, #183 | `weddingWeek.unit.ts`, `downloadStore.unit.ts`: delivered owner/joined list |
| 8c Hand-over packet | #162, #181, #183 | `packet.unit.ts`, `downloadStore.unit.ts`: every delivered task, free-content boundary, A4/Letter |
| 9 More and deletion | #156, #166, #170, #181 | `deletePlan.unit.ts`, `eventStore.unit.ts`: planning/signup keys removed, setting changes reflected, sharing stopped best effort, paid history retained |
| 10 Store files | NAMED STOP [WAITS_FOR_LAUNCH_PLAN] | Deliberately deferred by owner |
| 11 Store-build gate | #157, #159 | `releaseGate.unit.ts`; submission still refuses placeholder identity and absent registration receipt |
| 12 Website app line | NAMED STOP [WAITS_FOR_LAUNCH_PLAN] | Deliberately deferred by owner |
| 13 Scorecard | #157, #190; seq23/boss-os#386 OPEN, all checks green | Reach and server-verified transaction source, SQL reader; Boss OS row, launch clock, 3/6 floors and version B tested in its registration PR |
| Purchase door | #169, #172, #183–#189 | Server `app-unlock.test.ts`; phone `downloadStore.unit.ts`, `checkout.unit.ts`; verification precedes downloads, unknown/refused answers match |
| Paid-content leak check | #174 | `paidContent.unit.ts`: tracked-repository fingerprint scan, negative copy fixtures, zero-input refusal; missing ZIP text explicitly NOT RUN |
| Target-day load check | #179 | `scripts/load/app-day.mjs`, `app-day-load.test.ts`, `.github/workflows/app-day-load.yml`: 3,000 opens and 1,000 writes; separate AI replay covers 3,000 mocked requests; remote execution requires isolated preview |
| Free calendar file | #167 | `calendar.unit.ts`; More exports through shared `lib/plan-ics.ts` |

All reachable screen routes use their implemented view. The old Two phones tab
is removed; sharing now lives under More. Owner access uses
`billing/ownerPlan.ts` without an invitation. Screen registry fallback strings
are dormant metadata, not visible placeholders. Navigation and route tests cover
the full route map. No new screen patterns are needed in this documentation PR.

## Open PRs and release setup

- App #189 preserves verified ownership when extras fail, suppresses repeat
  offers, retries delivery through Restore, and avoids ZIP byte reads on normal
  plan opens. It contains the interrupted run's billing edits. Do not duplicate
  or merge it here; money-path coordinator review remains required.
- Boss OS #386 registers `dw-phone-app` using its existing D1 reader. Once it
  merges, record the actual merge receipt in `release/scorecard.json`
  (`bossOsRowId` and `recordedAt`). Both remain null until that receipt exists;
  NAMED STOP [SCORECARD_NOT_REGISTERED] intentionally still blocks submission.
- NAMED STOP [DW_STORE_NOT_SET_UP] and [REVENUECAT_SECRET_MISSING]: real store
  purchases/Restore remain disabled until owner-held store setup and secrets
  exist. Store metadata and production measurements were not verified live.
- Production measurement requires migration `0010_app_metrics.sql`, explicit
  server `APP_METRICS_ENABLED=true`, and native release
  `EXPO_PUBLIC_DW_METRICS=1`. Preview, development and web reach are excluded;
  sandbox transactions do not count. See Boss OS #386's setup notes. Collection
  is off by default; no flags or live records were changed in this reconciliation.
- Private delivery files to supply: `~/.boss-os/dream-wedding/printables-v1.zip`
  → `dream-wedding-builder-products/app/printables-v1.zip`, and
  `~/.boss-os/dream-wedding/day-of-kit-v1.zip` →
  `dream-wedding-builder-products/app/day-of-kit-v1.zip`. Each ZIP may be up to
  25 MiB and is stored as a separate phone file. Code and tests use fictional
  fixtures; live private archive delivery and archive-text leak comparison are
  NOT RUN until those files are supplied. No private text belongs in this repo.
- NAMED STOP [WAITS_FOR_LAUNCH_PLAN]: tasks 10 and 12. Store submission also needs
  the registered bundle identifier and the launch legal/store review.

The obsolete PATTERN_NOTES_MISSING and PRIVATE_WRITE_NEEDED implementation stops
are retired: supplied patterns and fixture-tested code paths cover those rows.
Real-device purchase/delivery validation and production load execution are not
claimed by unit tests or the free web preview.
