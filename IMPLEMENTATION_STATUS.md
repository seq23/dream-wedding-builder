# Implementation Status

## Completed in this snapshot

- Preserved the existing browser-based wedding builder, paid-order fulfillment, commerce, admin, product-release, canonical-host, 67-guide, and 100K authority-scale systems.
- Removed the rejected free-template acquisition layer in full:
  - six public starter downloads;
  - five free-asset preview graphics;
  - free-asset manifest;
  - download-event API and client tracker;
  - free-download D1 migration;
  - free-template distribution packet and Pinterest copy;
  - free-starter navigation, banners, hub CTAs, and measurement fields.
- Generated 20 distinct paid-product preview images from the canonical paid release files:
  - five previews per product;
  - actual PDF pages and XLSX sheets;
  - flattened and watermarked;
  - source page/sheet, file path, byte count, and SHA-256 recorded in `data/products/product_preview_manifest.json`.
- Rebuilt every paid product page with a real “Look inside the paid files” gallery, exact file inventory, workbook-sheet inventory, protected-preview boundary, and checkout CTAs.
- Rewired all eight SEO hubs and site navigation toward educational content plus genuine paid-product previews, without distributing a usable substitute for a paid product.
- Replaced free-template distribution materials with paid-product-preview outreach and Pinterest copy.
- Added validator enforcement for preview provenance, uniqueness, checksums, public/private boundaries, catalog parity, and complete absence of the rejected free-download layer.
- Regenerated the 75-record authority atlas, 67-guide admission report, sitemaps, distribution manifests, and authority-yield artifacts.

## Provider-gated remaining work

- Install dependencies and run typecheck, unit tests, production build, and browser journeys in the local updater environment. This container has no `node_modules`, so dependency-backed validation could not run.
- Apply only `migrations/0001_fulfillment.sql` to production D1. The rejected free-download migration was removed.
- Upload governed paid releases to R2 and bind Resend, signing, admin, and provider secrets.
- Deploy the snapshot and prove the four-domain redirect/canonical matrix and paid-preview galleries against live hosts.
- Submit deployed sitemaps/indexing requests and collect Search Console, IndexNow, crawl, ranking, product-preview, checkout, and conversion evidence.
- Execute manual blogger/community outreach only where paid-product preview links are appropriate and record observed live backlink outcomes.
- DONE (verified 2026-10-08 against production D1): one live paid purchase completed on 2026-07-11, `DWB-CHECKLIST-001`, $9.00, `payment_status=paid`, Stripe `cs_live_` session and `checkout.session.completed` event recorded, entitlement issued. The provider receipt is the `orders`/`stripe_events` rows.
- Open from that purchase: the delivery email failed (`delivery_attempts.status=FAILED`, Resend: "The weddingchecklistpdf.com domain is not verified"). On-screen access worked; email delivery needs the domain verified in the Resend account whose key is the Worker's `RESEND_API_KEY`.

## Current readiness

`STRUCTURALLY CHECKED — LOCAL VALIDATION REQUIRED`

Repo-local structural, commerce, paid-download, authority, preview-integrity, SEO, distribution, and 100K authority-scale checks passed. Dependency-backed build validation, provider execution, live-domain behavior, indexing, rankings, backlinks, and purchases remain unproven.

## Deep Validation Correction — 2026-07-30

The prior replacement baseline reached the local dependency-backed TypeScript gate and exposed two real typing defects. This corrective snapshot fixes those defects, adds explicit product/host contracts, hardens checkout environment validation, and adds five-SKU checkout route coverage.

Deep repo-local validation now passes across structural validators, authority flows, strict source fallback typing, actual-source unit fallbacks, checkout and middleware HTTP fallbacks, governed release hashes, PDF rendering, XLSX/ZIP integrity, preview uniqueness, public paid-file exclusion, and secret scanning.

Dependency-backed `npm run validate:all`, Next/OpenNext build, Playwright, real Stripe test-mode session creation, provider fulfillment, deployment, and the locally reported security-audit findings remain unclaimed until executed in the appropriate environment.

**Current readiness:** `STRUCTURALLY AND DEEPLY CHECKED — DEPENDENCY-BACKED LOCAL VALIDATION REQUIRED`

## Revenue pass — 2026-10-08

- Homepage sells the $9 Wedding Checklist PDF: title, hero and the primary CTA post straight to Stripe checkout (`DWB-CHECKLIST-001`).
- Free planning builder opens after an email with explicit consent; addresses go to D1 `builder_signups` (`migrations/0002_builder_signups.sql`, also created by the route). No email is sent.
- $39 Operations Suite shown as a bundle against the four individual prices ($52, save $13). Stripe prices unchanged.
- Affiliate slots (Zola, Minted, Amazon wedding registry) on every guide and hub page and the builder, driven by `data/affiliates/partners.json`; plain untracked links until `affiliate_url` is filled.
- Cloudflare Web Analytics beacon rendered per host from `data/cf_web_analytics.json`.

## Delivery email (2026-10-08)

- Guard landed: failed delivery emails are logged (`DELIVERY_EMAIL_FAILED`), shown on `/admin`, and turn
  `/api/health/delivery` to 503. See docs/PAID_ORDER_FULFILLMENT_RUNBOOK.md.
- NAMED STOP: `mail.weddingchecklistpdf.com` is not yet a verified domain in the owner's personal Resend
  account. Adding it needs a logged-in Resend session (or a full-access key from that account in the
  vault); the vault's only labelled Resend key belongs to West Peek and must not be used. Until then
  `/api/health/delivery` reports 503 for the 2026-07-11 order, by design.
