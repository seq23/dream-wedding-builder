# Product release runbook

1. Update source under `product-source/`.
2. Run `python scripts/generate_product_downloads.py`.
3. Run `npm run validate:downloads`.
4. Review rendered previews before release.
5. Upload exact manifest files to private R2 object keys.
6. Record provider receipts and Stripe catalog mapping.
7. Never overwrite a paid file without a new version and checksum.
