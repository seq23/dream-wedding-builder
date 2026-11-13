# Product release runbook

1. Update source under `product-source/`.
2. Build the files in the private folder (`DW_PRODUCTS_DIR`, default `~/.boss-os/dream-wedding/products`): the generators live there, in `scripts/`, never in this public repo.
3. Run `npm run release:package`, then `npm run validate:downloads` (it reads the private files when the folder exists).
4. Review rendered previews before release.
5. Upload with `npm run release:upload -- <product-id>` (checks the exact files first; see `docs/PAID_ORDER_FULFILLMENT_RUNBOOK.md`).
6. Record provider receipts and Stripe catalog mapping.
7. Never overwrite a paid file without a new version and checksum.
