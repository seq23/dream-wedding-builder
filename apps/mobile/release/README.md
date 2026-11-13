# Store build gate and release handoff

`npm run release-gate` checks store configuration without dependencies. EAS runs
it from `eas-build-pre-install` for production/store distribution. Named stops
exit 2; internal previews remain available. Passing it is not a store launch
approval or proof of live purchase, delivery or sharing readiness.

- `PREVIEW_BUILD`: remove `EXPO_PUBLIC_DW_PREVIEW` entirely from the store environment.
- `BUNDLE_ID_PLACEHOLDER`: set `release/config.json` to the owner's registered
  identifier after store setup. Expo reads that same value for both platforms.
- `LEGAL_LINKS_MISSING`: configure the canonical HTTPS privacy/terms URLs.
  More reads the same configuration. This checks configuration, not legal-page
  readiness; task 10 remains part of the launch plan.
- `SCORECARD_NOT_REGISTERED`: app measurement source and SQL reader merged in
  Dream Wedding #190. Boss OS registration is in
  [seq23/boss-os#386](https://github.com/seq23/boss-os/pull/386), currently open
  with green checks. After merge, record the real `dw-phone-app` row ID and merge
  timestamp in `scorecard.json`. Do not fill a receipt for an unmerged PR.

The row reads deduplicated production full-plan transactions per 100 installation
first reaches in a rolling 30-day window. Zero reach is unmeasured, not 0%
conversion. Its clock starts on the first production reach after collection is
enabled. Floors are 3 at day 30 and 6 at day 60; a day-30 miss tries version B,
reminders free with payments and packet paid. Store price changes stay in the
stores. Installation reach approximates people; reinstall and partner phones can
count again, and the ratio is not a matched acquisition cohort.

## Before production measurement

Apply `migrations/0010_app_metrics.sql` through the approved deployment path.
Enable server `APP_METRICS_ENABLED=true` and native release
`EXPO_PUBLIC_DW_METRICS=1` only for launch. Neither is enabled here. The server
collects only opaque hashes/timestamps; unlocks originate in server verification,
not client sales events. Preview/development/web reach and sandbox transactions
are excluded. Missing tables fail visibly. Boss OS #386 documents the existing
D1 reader and launch timing; its tests execute the manifest SQL against fixtures.

## Remaining launch dependencies

NAMED STOP [DW_STORE_NOT_SET_UP] and [REVENUECAT_SECRET_MISSING]: actual store
purchases/Restore require owner-held setup. The mocked flow, event rules, verified
owner access, joined access and offline delivery are built. App #189 (open,
green; coordinator review required) completes retry/ownership and archive-read
review fixes. Do not merge money-path PRs as part of this handoff.

The coordinator must supply these private files to the private R2 bucket
`dream-wedding-builder-products`:

| Private source | Bucket key |
|---|---|
| `~/.boss-os/dream-wedding/printables-v1.zip` | `app/printables-v1.zip` |
| `~/.boss-os/dream-wedding/day-of-kit-v1.zip` | `app/day-of-kit-v1.zip` |

Each ZIP may be up to 25 MiB; each is saved separately with a small metadata
record. Failed extras preserve the full plan; Restore retries delivery. Seven
tradition packs were uploaded according to the coordinator's audit additions.
Unit fixtures prove the code path, not the existence of live ZIPs. The paid-task
and tradition fingerprint scan runs across tracked repository files; ZIP-text
comparison explicitly reports NOT RUN while the private ZIPs are absent. Keep
all private source and archive text out of the repo and app bundle.

NAMED STOP [WAITS_FOR_LAUNCH_PLAN]: tasks 10 (store files/submission preparation)
and 12 (website app link). Wedding-week, packet and tradition screen-pattern
stops are retired; these screens and partner invite/join/stop are implemented.

Run the target-day check only against an isolated preview with its test model:
see `.github/workflows/app-day-load.yml` and `scripts/load/app-day.mjs`. Missing
preview configuration produces a named stop, never a successful empty run.
Live load execution and real-device/store verification are not certified by
unit tests. The free hosted phone preview remains the owner's build review link.

The complete audit-to-PR mapping is in `docs/APP_BUILD_STATUS.md`.
