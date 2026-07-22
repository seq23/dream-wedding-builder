# Dream Wedding Builder

Dream Wedding Builder is the only free product in a shared five-domain wedding planning platform. The paid portfolio is Wedding Seating Chart Maker, Wedding Budget Spreadsheet, Wedding Timeline Template, Wedding Checklist PDF, and the Dream Wedding Operations Suite.

## Preserved free journey
`/build` remains the guided no-login Builder and Starter Pack experience.

## Paid commerce routes
- `/products/seating-chart-maker`
- `/products/budget-spreadsheet`
- `/products/timeline-template`
- `/products/checklist-pdf`
- `/shop`

## Local structural validation
```bash
npm install
python -m pip install reportlab
python scripts/generate_product_downloads.py
npm run validate:all
```

`npm run validate:all` is a non-mutating check profile. It runs typecheck, unit tests, and structural validators. It does not generate authority artifacts, generate product downloads, deploy, bootstrap providers, or run a production build.

For the heavier local proof run that explicitly regenerates authority artifacts and runs the production build:

```bash
npm run proof:local-full
```

## Provider proof boundary
The repo contains Stripe, entitlement, protected-download, email, multi-domain, authority, vault, and admin contracts. Live Stripe/Resend/Cloudflare/GSC/IndexNow proof is not claimed until credentials are installed and deployed journeys are executed.

Customer support: `info@weddingchecklistpdf.com`.
