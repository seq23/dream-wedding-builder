# Paid Order Fulfillment Runbook

## Runtime journey

1. Stripe Checkout completes.
2. Stripe sends `checkout.session.completed` to `/api/stripe-webhook`.
3. The Worker verifies the Stripe signature and ignores replayed event IDs.
4. D1 records the Stripe event, order, and entitlement.
5. The entitlement points to `products/<product-id>/current.zip` in the private `PRODUCT_RELEASES` R2 bucket.
6. The system creates a 7-day signed download URL (`EMAIL_LINK_TTL_MS` in `lib/fulfillment.ts`) and sends it through Resend.
7. `/order/success` verifies the Stripe Checkout Session and creates a fresh one-hour download link when the entitlement and R2 object are available.
8. `/api/download/[token]` verifies expiry, entitlement status, and R2 object presence before streaming the private file.

## Required Worker secrets

- `STRIPE_MODE`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `APP_BASE_URL`
- `DOWNLOAD_SIGNING_SECRET`
- `RESEND_API_KEY`
- `APP_FROM_EMAIL`
- `APP_REPLY_TO_EMAIL`

## Required bindings

- D1 binding: `DB`
- Private R2 binding: `PRODUCT_RELEASES`

## Apply the D1 schema locally after the snapshot is installed

`env -u CLOUDFLARE_API_TOKEN npx wrangler d1 execute dream-wedding-builder --remote --file=migrations/0001_fulfillment.sql`

## Required R2 object keys

- `products/seating-chart-maker/current.zip`
- `products/budget-spreadsheet/current.zip`
- `products/timeline-template/current.zip`
- `products/checklist-pdf/current.zip`
- `products/operations-suite/current.zip`

- `products/courthouse-wedding-kit/current.zip`
- `products/wedding-vows-workbook/current.zip`
- `products/maid-of-honor-kit/current.zip`

### Where the paid files live (13 Nov 2026)

Paid content never sits in this public repo (owner ruling, 10 Nov 2026). The product
PDFs, workbooks, CSVs and packaged zips, and the two scripts that hold their full
text, live in a private folder on the owner's Mac, laid out as they were in the repo:

- `DW_PRODUCTS_DIR` (default `~/.boss-os/dream-wedding/products`)
  - `product-builds/releases/` the loose files
  - `product-builds/r2/products/<product-id>/current.zip` the packaged objects
  - `scripts/generate_product_downloads.py`, `scripts/products/book_kits.py` the generators

The repo keeps only `product-builds/manifests/download_manifest.json` and
`product-builds/r2/release_manifest.json`: file names, sizes and SHA-256, no content.
Git history before 13 Nov 2026 still holds the old copies; refreshed v2 products
are the follow-up that makes those copies stale.

### Package and upload

```bash
npm run release:package                    # private files -> private current.zip, rewrites release_manifest.json
npm run release:upload -- --check          # run the file checks only, upload nothing
npm run release:upload -- checklist-pdf    # checks, then uploads that one product to R2
```

- `release:upload` always runs `validate-downloads.mjs --require-files` on the exact
  files first: present, checksums equal to the committed manifests, file types,
  sizes, advertised formula counts. Any failure stops with `[PRODUCT_FILES_UNSAFE]`
  and uploads nothing.
- A product must be named. An upload replaces what paying customers receive.
- No private folder: every script that needs the files stops with
  `[PRODUCTS_DIR_MISSING]` and exits non-zero.
- CI has no private folder. There `npm run validate:downloads` checks the two
  manifests against the catalog and the key `lib/fulfillment.ts` serves, and prints
  `PRODUCT FILES NOT READ`. The mobile check (`apps/mobile`, `npm run check`) fails
  if any paid product file is tracked in git again.
- Commit the changed `release_manifest.json` with the upload.

Read back on 13 Nov 2026 (`~/.boss-os/dream-wedding/readback/products-2026-11-13/`):
the three book kits in R2 are byte-identical to the packaged copies. The other five
R2 objects were uploaded on 11 Jul 2026, before `release:package` existed. Four hold
the same three inner files in a different zip container. `operations-suite` in R2 is
the eight-file `DWB-SUITE-001_complete` zip itself, without the suite PDF and starter
CSV that the packaged copy adds. Nothing was re-uploaded.

Until an object exists, a paying customer with a valid entitlement and a valid signed token receives HTTP 404 from `/api/download/[token]`.

The order-status endpoint truthfully reports `AWAITING_ASSET` until the matching object exists. Payment remains recorded and no second charge is required.

## Failure and retry behavior

- Duplicate Stripe event IDs return success without creating duplicate orders, but only once the first attempt has finished. An event whose first attempt failed part-way through (for example a Resend outage) is re-processed on Stripe's retry rather than being dismissed as a duplicate, so the delivery email is not lost.
- Missing or invalid signatures return HTTP 400.
- A paid session without a governed SKU or customer email records the event error and returns HTTP 500 so Stripe can retry.
- Missing Resend configuration records `PENDING_PROVIDER` in `delivery_attempts` and returns HTTP 500 so Stripe retries once the key exists.
- A Resend failure records `FAILED` and returns HTTP 500 so Stripe retries the webhook.
- Missing R2 product objects do not fabricate fulfillment; the success page reports that the release awaits upload.
- Revoked entitlements return HTTP 403 from the download route.

## Live proof still required

Provider population and a controlled real purchase must verify the webhook, D1 rows, delivery email, R2 file, and completed download journey after deployment.

## Verify the fulfilment path end to end

`npm run proof:fulfillment` drives the real routes over HTTP against a running worker instead of inferring correctness from the code. It needs no Stripe credentials: the webhook signature is an HMAC over the raw body, so a locally signed payload is indistinguishable from a genuine one to the handler.

```bash
npx wrangler d1 execute dream-wedding-builder --local --file=migrations/0001_fulfillment.sql
npm run release:upload -- checklist-pdf --local
npx wrangler dev --port 8788 --local   # in a second shell
BASE_URL=http://localhost:8788 \
  STRIPE_WEBHOOK_SECRET=<the value the worker is running with> \
  DOWNLOAD_SIGNING_SECRET=<the value the worker is running with> \
  npm run proof:fulfillment
```

It covers signature enforcement, the replay window, unpaid sessions, entitlement creation, event deduplication, and download-token gating. Two legs it cannot cover: Stripe's own session creation, which needs a real `sk_test_` key, and Resend delivery, which needs `RESEND_API_KEY`.

## Delivery email is never silent (2026-10-08)

Incident: the only real order (2026-07-11, order `ed5ddcdc-23ec-4dbf-83e5-a24bde689d04`) was paid but its
email was rejected by Resend because `weddingchecklistpdf.com` was not a verified sending domain in the
account behind `RESEND_API_KEY`. The error sat in `delivery_attempts` for three months unseen.

- `lib/delivery-email.ts` is the only code path that emails a buyer; the webhook imports it.
- Every non-SENT outcome writes a `DELIVERY_EMAIL_FAILED` JSON line to Workers Logs (`observability`
  is on in `wrangler.jsonc`), with order id and email domain only.
- `/api/health/delivery` returns 503 with `undelivered_count` while any paid order has no SENT email.
- `/admin` shows a red panel listing undelivered paid orders (id, email domain, last error).
- `tests/unit/delivery-email.test.ts` pins all of the above.

Sending account: the owner's personal Resend account (the one sending `codes@mail.aplayermode.com`),
never West Peek's. Sender: `orders@mail.weddingchecklistpdf.com`, set via the `APP_FROM_EMAIL` secret.

## Undelivered orders recover on their own (2026-10-09)

Replaying the Stripe event cannot re-send an email (`stripe_events` dedupes on `event_id`), so recovery
is a Worker cron trigger, not a replay.

- `wrangler.jsonc` `main` is `worker.ts`, a thin wrapper that forwards `fetch` to OpenNext's
  `.open-next/worker.js` and adds `scheduled`. `triggers.crons` runs it hourly (`0 * * * *`).
- `lib/delivery-retry.ts` `runDeliveryRetry()` picks paid orders with **no SENT attempt at all**, older
  than 15 minutes, and re-sends through `sendDeliveryEmail()` with a fresh 7-day download token.
  Each retry records a `delivery_attempts` row with channel `email_retry`.
- Cap: 5 retries, backoff 0 / 1 h / 3 h / 12 h / 24 h. An order that exhausts them stays on the
  `/admin` red panel marked "automatic retries exhausted" and keeps `/api/health/delivery` at 503.
- `/admin` has a "Resend delivery email" button per undelivered order
  (`POST /api/admin/orders/<id>/resend`, owner session only). It ignores the cap, records channel
  `email_manual`, and still refuses an order that already has a SENT attempt.
- Each run logs one `DELIVERY_RETRY_RUN` line to Workers Logs (counts, order ids, outcomes).
- To run it now rather than wait for the hour: press the button on `/admin`, or locally
  `npx wrangler dev --test-scheduled` and `curl "http://localhost:8787/__scheduled?cron=0+*+*+*+*"`
  (local D1 only). Production cron runs are listed under the Worker's Settings → Trigger Events.
- `tests/unit/delivery-retry.test.ts` runs the real queries on SQLite (sql.js) against
  `migrations/0001_fulfillment.sql` and pins: only undelivered paid orders, no double send, the cap,
  backoff, and the wiring.

## A buyer can always get her links again (2026-11-11)

Found by a test purchase: the emailed links died after 24 hours and the only way back was the order
success page, which no buyer keeps. The 24 hours had no recorded reason (it came with the first
snapshot). Every use of a link re-checks that the purchase is still `ACTIVE`, so a refund ends a link
at once whatever its age.

- Emailed links now work for 7 days (`EMAIL_LINK_TTL_MS`).
- `/order/link` ("Already bought? Get your link again." in the footer, and one sentence in the order
  email) has one field, the email she bought with, and one button. `POST /api/fresh-link` sends the
  same order email again, through `sendDeliveryEmail()` with channel `email_fresh_link`, for every
  `ACTIVE` purchase under that address (`lib/fresh-link.ts`).
- The answer is the same sentence whether or not a purchase was found. Limits (`lib/abuse-limits.ts`):
  5 asks an hour per caller (then HTTP 429), 3 emails a day per address (then the same answer, nothing
  sent). Keys are hashes; no address is stored or logged by this path.
- A link we issued that has run out: `/full-plan` shows the same form, and `/api/download/<token>`
  answers 303 to `/order/link?expired=1`. A forged or broken link still gets 401 and no form.
- It is order mail, not marketing: no opt-out list and no marketing ceiling apply, as for the first
  order email.
- `tests/unit/fresh-link.test.ts` runs the real routes and SQL and pins all of the above.
