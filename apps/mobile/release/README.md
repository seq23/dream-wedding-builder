# Store build gate

`npm run release-gate` checks store configuration without dependencies. EAS runs it
from `eas-build-pre-install` for production/store distribution; internal previews
remain available. Named stops exit 2.

- PREVIEW_BUILD: remove EXPO_PUBLIC_DW_PREVIEW entirely from the store environment.
- BUNDLE_ID_PLACEHOLDER: after store setup, set release/config.json bundleId to the registered identifier. Expo reads this same file for both platforms.
- LEGAL_LINKS_MISSING: restore HTTPS privacy and terms URLs in release/config.json. More reads these same links. This checks configuration, not legal readiness or page availability; task 10 is the separate launch stop.
- SCORECARD_NOT_REGISTERED: task 13 is prepared in scorecard.json but not registered in Boss OS. Register its row and working measurement reader before submission, then record the real row ID and timestamp. Do not invent a receipt. The proposed floors are 3 unlocks per 100 plan viewers by day 30 and 6 by day 60. Start the clock at launch. Apply version B after a day-30 miss; price changes are made in the stores.

NAMED STOP [SCORECARD_NOT_REGISTERED]: Boss OS registration requires a separate
Boss OS change, outside this run's single-repo scope. No telemetry is collected by
this batch. The row must have a functioning reader before this stop is cleared.

Tasks 8b/8c: NAMED STOP [PATTERN_NOTES_MISSING] wedding-week sheet and hand-over packet.
Tasks 10/12: NAMED STOP [WAITS_FOR_LAUNCH_PLAN].

Passing this narrow gate does not certify purchases, sharing, store accounts or a
launch. Existing purchase and launch gates still apply.
