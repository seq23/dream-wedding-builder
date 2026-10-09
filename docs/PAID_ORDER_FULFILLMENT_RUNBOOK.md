# Paid Order Fulfillment Runbook

## Runtime journey

1. Stripe Checkout completes.
2. Stripe sends `checkout.session.completed` to `/api/stripe-webhook`.
3. The Worker verifies the Stripe signature and ignores replayed event IDs.
4. D1 records the Stripe event, order, and entitlement.
5. The entitlement points to `products/<product-id>/current.zip` in the private `PRODUCT_RELEASES` R2 bucket.
6. The system creates a 24-hour signed download URL and sends it through Resend.
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

Build those objects from the committed canonical files and upload them:

```bash
npm run release:package
npx wrangler r2 object put dream-wedding-builder-products/products/checklist-pdf/current.zip \
  --file=product-builds/r2/products/checklist-pdf/current.zip --remote
# repeat for the other four keys; release:package prints the full command list
```

`npm run release:package` is the only thing that produces these objects. Until it has been run and the output uploaded, a paying customer with a valid entitlement and a valid signed token receives HTTP 404 from `/api/download/[token]`. `npm run validate:downloads` now fails if the packaged objects are missing, stale, or keyed differently from what `lib/fulfillment.ts` derives.

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
npm run release:package
npx wrangler r2 object put dream-wedding-builder-products/products/checklist-pdf/current.zip \
  --file=product-builds/r2/products/checklist-pdf/current.zip --local
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
  than 15 minutes, and re-sends through `sendDeliveryEmail()` with a fresh 24-hour download token.
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
