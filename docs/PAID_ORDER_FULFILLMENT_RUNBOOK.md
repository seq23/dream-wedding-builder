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

The order-status endpoint truthfully reports `AWAITING_ASSET` until the matching object exists. Payment remains recorded and no second charge is required.

## Failure and retry behavior

- Duplicate Stripe event IDs return success without creating duplicate orders.
- Missing or invalid signatures return HTTP 400.
- A paid session without a governed SKU or customer email records the event error and returns HTTP 500 so Stripe can retry.
- Missing Resend configuration records `PENDING_PROVIDER` in `delivery_attempts`.
- A Resend failure records `FAILED` and returns HTTP 500 so Stripe retries the webhook.
- Missing R2 product objects do not fabricate fulfillment; the success page reports that the release awaits upload.
- Revoked entitlements return HTTP 403 from the download route.

## Live proof still required

Provider population and a controlled real purchase must verify the webhook, D1 rows, delivery email, R2 file, and completed download journey after deployment.
