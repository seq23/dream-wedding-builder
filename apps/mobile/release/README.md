# Store build gate and release handoff

`npm run release-gate` checks store configuration without dependencies. EAS runs
it from `eas-build-pre-install` for production/store distribution. Named stops
exit 2; internal previews remain available. Passing it is not a store launch
approval or proof of live purchase, delivery or sharing readiness.

- `PREVIEW_BUILD`: remove `EXPO_PUBLIC_DW_PREVIEW` entirely from the store environment.
- `REVENUECAT_KEY_MISSING`: the store build's platform has no public RevenueCat key
  with the right prefix (`EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` = `goog_…`,
  `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` = `appl_…`) in the EAS `production` environment.
  Set it from the vault (`REVENUECAT_DW_ANDROID_PUBLIC_KEY` / `REVENUECAT_DW_IOS_PUBLIC_KEY`).
- `BUNDLE_ID_PLACEHOLDER`: set `release/config.json` to the owner's registered
  identifier after store setup. Expo reads that same value for both platforms.
- `LEGAL_LINKS_MISSING`: configure the canonical HTTPS privacy/terms URLs.
  More reads the same configuration. This checks configuration, not legal-page
  readiness; task 10 remains part of the launch plan.
- `SCORECARD_NOT_REGISTERED`: cleared. The app measurement source and SQL reader merged
  in Dream Wedding #190; the Boss OS row `dw-phone-app` was registered by
  [seq23/boss-os#386](https://github.com/seq23/boss-os/pull/386), merged
  2026-11-13T13:43:51Z, and `scorecard.json` records it. The stop returns if the row id
  or date is ever removed.

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

Both are built by the private generator (`products/scripts/app_extras.py`) and listed by name and
checksum in `store/paid-files.json` (`node scripts/store/paid-files.mjs write ~/.boss-os/dream-wedding`).
After upload, read each object back from R2 and run `node scripts/store/paid-files.mjs verify
<printables|day_of_kit> <readback.zip>`: it stops on any difference. Each ZIP may be up to 25 MiB; each is saved separately with a small metadata
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

## TestFlight builds

Cloud route: `eas build --platform ios --profile production` (Expo free plan). When the
free plan's iOS builds for the month are used up, run the manual `iOS store build`
workflow (free GitHub macOS runner, `eas build --local`, same profile and remote build
number). It submits the `.ipa` to App Store Connect (TestFlight) in the same job with
`eas submit --path`, using the App Store Connect API key from the repo secrets
(`ASC_API_KEY_P8`, `ASC_API_KEY_ID`, `ASC_API_ISSUER_ID`; NAMED STOP [ASC_KEY_MISSING]
without them). The `.ipa` is never uploaded as an artifact: the repo is public. Only the
simulator build (`app-simulator`, for the App Review recording) is kept as an artifact.

## Google Play internal builds

Run the manual `Android store build` workflow on `main`. It builds the App Bundle on a free
GitHub runner (`eas build --local`, production profile and environment, remote versionCode),
stops unless the AAB is signed with the EAS upload key from 19 Nov 2026 (SHA-1
`4B:A3:70:F8:…:C4:5A`), submits it to the Play **internal** track as a **draft**
(`eas.json` submit.production.android), then reads the tracks back and fails unless that
versionCode is a draft on internal and on no other track. The service account
(`GOOGLE_PLAY_UPLOAD_SA_JSON`, release and testing tracks only) is written for the submit and
deleted in an `always()` step; the AAB is never uploaded as an artifact.

## Report this answer (AI content: Apple 1.2, Google Play)

`src/reportAnswer.ts` adds "Report this answer" under the AI read (Your wedding, described) and
the AI draft review, on iOS, Android and the web preview. It opens a pre-filled email to
info@weddingchecklistpdf.com (no backend; nothing is stored by us). There is no switch:
`test/reportAnswer.unit.ts` fails if a screen shows AI text without it.
