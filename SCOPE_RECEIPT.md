# Scope Receipt

## Repo / Project

Dream Wedding Builder — `seq23/dream-wedding-builder`

## Source of Truth

Uploaded cumulative baseline snapshot: `dream-wedding-builder-main_BASELINE_07-30-26_7f5543b9d13b.zip`

Source ZIP SHA256: `0ad8a4697b6ae27bf6050d2faa9b32dc8caeaa842c8a9bbaa363ec91258c4502`

## Full Intended System

A four-domain wedding-planning authority and commerce system in one Next.js/Cloudflare repo:

- `weddingchecklistpdf.com` owns checklist, planning, binder, and vendor-list intent.
- `weddingtimelinetemplate.com` owns wedding timeline intent.
- `weddingbudgetspreadsheet.com` owns wedding budget intent.
- `weddingseatingchartmaker.com` owns seating-chart and guest-list intent.

The public layer provides substantive planning guidance and transparent, protected views into the paid products. It does not distribute weakened copies of paid templates. Every public route has one canonical host, useful page content, explicit internal-link ownership, and honest separation between public previews, paid files, and external outcomes.

## Phase Ledger

| Phase | Scope | State in this snapshot |
|---|---|---|
| A | Remove rejected free-template layer | Complete |
| B | Generate authentic paid-file previews | Complete — 20 previews from canonical PDF/XLSX releases |
| C | Rebuild paid product commercial experience | Complete at repo level |
| D | Preserve and rewire SEO hubs/guides | Complete — 8 hubs and 67 guides |
| E | Replace governance, validation, measurement, and distribution contracts | Complete at repo level |
| F | Local dependency-backed validation | Pending local updater |
| G | Provider deployment and live proof | Provider-gated |

## Current Artifact Scope

One cumulative full baseline snapshot implementing the approved reversal and replacement while preserving the existing browser builder, commerce, fulfillment, admin, paid releases, canonical host architecture, SEO hubs, 67-guide content system, and 100K authority-scale runway.

## Implemented in This ZIP

- Deleted all six public starter downloads and their public preview graphics.
- Deleted the free-download tracker, API, D1 migration, asset manifest, navigation, hub CTAs, measurement fields, and distribution materials.
- Added five genuine previews per paid product, sourced from the actual canonical PDFs and XLSX sheets.
- Added preview provenance, checksums, byte counts, source pages/sheets, and exact paid inventory.
- Added a real “Look inside the paid files” gallery and exact deliverable inventory to every paid product page.
- Added product preview strips and paid-product CTAs to the eight educational SEO hubs.
- Preserved the original browser-based `/build` planning experience as a separate non-download product-discovery tool.
- Replaced free-template outreach with paid-product-preview outreach and Pinterest copy.
- Added validator enforcement for preview uniqueness, source integrity, non-public paid files, catalog parity, and absence of the rejected layer. Preserved former sample-image URLs as compatibility aliases, but replaced their contents with real paid-file previews to prevent cached 404s and stale fake imagery.
- Regenerated the 75-record atlas, 67-guide admission report, four host sitemaps, 93-URL distribution manifest, yield artifacts, and authority-scale validation receipts.

## Not Implemented in This ZIP

- No redesign of the underlying paid PDF or XLSX products.
- No removal of the original browser-based `/build` experience.
- No Cloudflare DNS, deployment, or live four-host verification.
- No production D1 migration execution, R2 uploads, Resend binding, or secrets population.
- No Search Console/IndexNow submission, crawl/index/rank proof, or observed external citations.
- No blogger outreach, community posting, Pinterest publishing, or live backlink acquisition.
- No controlled real-money purchase and provider-side fulfillment proof.
- No dependency-backed typecheck, unit tests, Next.js production build, or Playwright run in this container because required packages are not installed.

## Validation Run

- `CI=false npm run validate:structural` — PASS.
- `AUTHORITY_RUN_AT=2026-07-30T20:04:00-05:00 npm run authority:all` — PASS.
- `node scripts/validate-seo-recovery.mjs` — PASS: 8 hubs, 67 guides, 20 unique paid previews, 4 canonical hosts, rejected free-download layer absent.
- Canonical paid-download validator — PASS: 15 governed release files.
- Authority release manifest — 75 routes.
- Authority runway — 100,000 structurally validated opportunities.
- Distribution manifest — 4 domains and 93 governed URLs.
- Preview manifest — 4 products, 20 source-backed images, no duplicate hashes.
- Typecheck attempt — BLOCKED by missing installed dependencies; no dependency-backed result claimed.

## Production Readiness State

`STRUCTURALLY CHECKED — LOCAL VALIDATION REQUIRED`

## Remaining Work

- Local updater dependency installation and full validation.
- Provider population and deployment.
- Live host, preview, checkout, fulfillment, indexation, and measurement proof.
- External distribution execution and evidence collection.

## Next Artifact

Only a failure-specific replacement baseline is required if local validation reports a concrete defect. Provider receipts and live measurement belong to the deployed operating cycle.

## Rollback Path

Reapply `dream-wedding-builder-main_BASELINE_07-30-26_7f5543b9d13b.zip` with the generic updater.

## Deep Validation Corrective Phase — 2026-07-30

### Completed phase

Failure-specific correction after the local updater reached the real TypeScript gate and rejected the prior snapshot.

### Implemented in this corrective ZIP

- Resolved the paid-product metadata and canonical-host TypeScript defects.
- Added explicit checkout environment validation for all five governed SKUs.
- Added route-level checkout tests and browser-independent HTTP fallbacks.
- Strengthened environment validation and fixed the stale per-host guide-count unit expectation.
- Performed structural, authority, type-fallback, unit-fallback, checkout, middleware, release-hash, archive, PDF-render, preview-integrity, public-exposure, and secret checks.

### Not implemented in this corrective ZIP

- No changes to the paid product files or prices.
- No production Stripe session, charge, webhook, entitlement, email, or R2 proof.
- No live Cloudflare deployment or browser proof.
- No dependency-backed build claim in this sandbox because the internal package mirror could not supply one locked dependency.
- No remediation of the 12 high-severity audit findings reported by the local install without the advisory details.

### Remaining phases

1. Re-run the generic local updater against this corrected full baseline.
2. Complete dependency-backed `validate:all`, build, and browser gauntlet locally.
3. Complete controlled Stripe test-mode and then production/provider proof under valid secrets.

### Validation status

`STRUCTURALLY AND DEEPLY CHECKED — DEPENDENCY-BACKED LOCAL VALIDATION REQUIRED`
