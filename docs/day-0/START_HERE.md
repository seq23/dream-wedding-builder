# Day-0 Start Here

1. Read `data/products/product_catalog.json` and `docs/products/START_HERE.md` to understand every paid offer.
2. Use `info@weddingchecklistpdf.com` for all customer-facing support.
3. Never email a file from `product-source/`; customer files come from versioned `product-builds/releases/` and private R2 in production.
4. Verify the SKU, payment state, entitlement, and current release before resending access.
5. Do not change prices, refund rules, legal language, or product files without an approved release record.
6. Run `npm run validate:all` before packaging.
7. Use `docs/PAID_ORDER_FULFILLMENT_RUNBOOK.md` for order, entitlement, and download recovery.
8. Use `npm run proof:local-full` when you explicitly need authority regeneration plus production build proof.

9. Automation topology is intentional: `Authority Preflight Validation` is read-only, `Full Safe Autonomy` is the publishing lane, and `Search Intelligence` is a separate bounded repair/evidence lane.
10. `CONTENT_RELEASE_ENABLED=true` is the shared opt-in for both authority publication and Search Intelligence. `CONTENT_EMERGENCY_STOP=true` stops both lanes.
11. Paid binary uploads must verify the configured GitHub repository is actually private through the GitHub API before writing; no local privacy flag is treated as proof.
