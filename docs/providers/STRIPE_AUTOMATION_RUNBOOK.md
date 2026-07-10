# Stripe Automation Runbook

The repo will use a catalog-driven bootstrap command instead of manual Dashboard product creation.

## Required secret for test bootstrap
`STRIPE_SECRET_KEY=sk_test_...`

## Automated responsibilities
- Read `data/products/product_catalog.json`.
- Create or reuse Stripe Products by stable metadata key `dwb_product_id`.
- Create one-time Prices when the configured amount/currency does not exist.
- Record Stripe Product and Price IDs in a generated non-secret registry.
- Refuse silent test/live mixing.
- Create a receipt describing created, reused, or conflicting resources.

## Cloudflare secret binding
Use `wrangler secret put STRIPE_SECRET_KEY` and, after the endpoint exists, `wrangler secret put STRIPE_WEBHOOK_SECRET`.

## Owner-only actions that remain
Stripe account creation, identity/business verification, bank account connection, tax/legal decisions, and supplying the secret locally.
