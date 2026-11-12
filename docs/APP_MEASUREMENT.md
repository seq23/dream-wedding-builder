# App scorecard measurement source (task 13)

The app records first plan-screen reach per installation. The purchase door records
confirmed production full-plan store transactions, deduplicated across Restore and
phones by a SHA-256 of store, product and transaction ID. Sandbox, promotional,
refunded and unconfirmed receipts are excluded by the existing entitlement verifier.
This measures confirmed unlocks, rather than successful optional-file downloads.

Only hashes and timestamps go into D1. No event names, wedding dates, payment amounts,
task text, emails, raw purchase IDs or raw installation IDs are stored. Installation
identity survives Delete my plan so recreating a plan cannot manufacture another reach.
It is unrelated to the RevenueCat identity and does not call the SDK. Reinstalling
can count a person again; joining on a second phone counts another installation.
These are installation counts, a proxy for people, not signed-in unique people.

Collection defaults off. Before launch apply additive migration
`migrations/0010_app_metrics.sql`, set Worker `APP_METRICS_ENABLED=true`, and set native
store-build `EXPO_PUBLIC_DW_METRICS=1`. Preview, development and web app builds never
send reach events, regardless of that flag. The server also requires the production
host. Do not enable collection on preview Workers. The anonymous public reach endpoint
has per-IP and daily limits; its denominator can still be affected by forged IDs.
No client can report an unlock. Metrics do not grant purchases or block a saved plan.

Reach is acknowledged on the phone only after a server 204; offline failures retry on
the next plan focus. A three-second deadline bounds that attempt. The server's unique
key makes lost acknowledgements safe. Restore can backfill an unlock after a transient
database failure using its original purchase timestamp; metric failures log
`APP_METRICS_FAILED` and never block paid delivery. Investigate those logs before
trusting a scorecard reading.

The existing Boss OS `d1` reader can use `apps/mobile/release/scorecard-reader.sql`
with database `dream-wedding-builder`, days `30`, as both first and real metrics.
Floors stay 3 by day 30 and 6 by day 60; start its clock at launch, never at build.
Zero reach returns NULL (unmeasured); a missing migration throws, rather than
manufacturing a zero. The rolling window uses first reach time and original purchase
time, not repeat opens or Restore time. It is a period conversion ratio, not a matched
acquisition cohort; late purchases can refer to earlier viewers.

Remaining task 13 work: register the row in the Boss OS manifest with that reader,
the approved floors and version B, and then record its real row ID and registration
time in `release/scorecard.json`. This PR supplies the measurement source only; it
does not claim registration or clear `SCORECARD_NOT_REGISTERED`.
