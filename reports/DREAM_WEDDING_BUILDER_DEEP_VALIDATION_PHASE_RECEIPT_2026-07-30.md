# Dream Wedding Builder — Deep Validation Corrective Phase Receipt

**Date:** 2026-07-30 CT  
**Repo:** `dream-wedding-builder`  
**Validation mode:** On-demand deep verification and failure isolation  
**Correction source ZIP:** `dream-wedding-builder-main_BASELINE_07-30-26_706d63243ca4.zip`  
**Correction source ZIP SHA-256:** `5d80235738b717fc0a487123f0adaf635f6a86fb87f98423c6e6ea99257bf2ff`

## 1. Triggering Failure

The local updater installed the project dependencies and reached the repository's real `npm run validate:all` gate. It then failed during `tsc --noEmit` before unit or structural tests could begin.

Proven failures:

- `app/products/[slug]/page.tsx`: product metadata fields were inferred as `string | undefined`.
- `lib/site-config.ts`: un-narrowed strings were assigned to the four-host `SiteHost` union.

The local updater preserved the working tree and rolled back to its safety tag. No successful update, commit, push, deployment, or production checkout was claimed.

## 2. Corrective Changes

1. Replaced catalog-derived loose union inference with explicit paid-product, suite-product, preview, and inventory contracts in `lib/products.ts`.
2. Narrowed route, product, guide, and parent host values to the canonical four-host `SiteHost` model in `lib/site-config.ts`.
3. Simplified product-page references now guaranteed by the paid-product contract.
4. Extracted checkout environment validation and Stripe Checkout parameter construction into `lib/checkout-contract.ts`.
5. Refactored `/api/checkout` to fail closed before contacting Stripe when mode, key, price ID, SKU, or callback configuration is invalid.
6. Added checkout route tests covering every governed SKU and exact environment-variable mapping.
7. Strengthened `validate-env.mjs` so checkout variables and route/contract wiring are structural release gates.
8. Corrected the host guide-count unit test to validate the governed minimum across all four canonical hosts rather than a stale checklist-only count.

## 3. Checkout Environment Contract Tested

The following exact variable names are now validated and exercised:

- `APP_BASE_URL`
- `STRIPE_MODE`
- `STRIPE_SECRET_KEY`
- `STRIPE_SEATING_CHART_MAKER_PRICE_ID`
- `STRIPE_BUDGET_SPREADSHEET_PRICE_ID`
- `STRIPE_TIMELINE_TEMPLATE_PRICE_ID`
- `STRIPE_CHECKLIST_PDF_PRICE_ID`
- `STRIPE_OPERATIONS_SUITE_PRICE_ID`

Checkout test coverage:

- all five governed SKUs;
- JSON and browser form submissions;
- correct Stripe endpoint, bearer header, price ID, quantity, mode, success URL, cancel URL, and product metadata;
- unknown SKU rejection before network contact;
- missing key rejection;
- test/live key-mode mismatch rejection;
- unsupported `STRIPE_MODE` rejection;
- malformed and missing price-ID rejection;
- Stripe error response handling remains fail-closed.

**Proof state:** `DRY_RUN_PROVEN` with synthetic test-mode values and a mocked Stripe network response. No real Stripe secret or price ID was available in this validation environment, so no provider-side Checkout Session, charge, webhook, entitlement, R2 delivery, or email receipt is claimed.

## 4. Validation Matrix

| Validation layer | Result | Evidence boundary |
|---|---|---|
| Original local updater dependency install | Reached TypeScript validation | User-provided updater log |
| Original local TypeScript run | FAIL, isolated | Two source-contract defects listed above |
| Repo-native structural suite | PASS | All structural validators completed |
| Full-source strict TypeScript fallback | PASS | Local project relationships checked; external framework APIs stubbed |
| Core strict TypeScript check | PASS | Product, host, and checkout contracts |
| Product metadata type smoke | PASS | Exact original metadata failure surface |
| TS/TSX syntax transpilation | PASS — 93 files | All implementation TypeScript/TSX parsed |
| Actual-source unit fallback | PASS — 5 groups | Host ownership, Stripe signature, fulfillment tokens, product rules, checkout contract |
| Actual checkout-route fallback | PASS | 5 SKUs, JSON/form, env mapping, network payload, fail-closed cases |
| Middleware HTTP fallback | PASS — 8 cases | `www`, root, wrong-host, guide, product, preview-host, API, sitemap behavior |
| Authority full flow | PASS | 75 routes; 67 admitted guides; four sitemaps; 100,000 governed opportunities |
| Governed release SHA-256 | PASS — 15 files | Every release matches `download_manifest.json` |
| PDF integrity and rendering | PASS — 5 PDFs / 57 pages | Every page rendered; contact-sheet visual review completed |
| XLSX archive integrity | PASS — 4 workbooks | Required OOXML parts and worksheets present |
| CSV structure | PASS — 5 setup CSVs | Headers parse; files remain private release assets |
| Suite ZIP integrity | PASS — 1 ZIP / 8 entries | Archive test completed |
| Paid-file public exposure | PASS | Zero PDF/XLS/XLSX/CSV/ZIP files under `public/` |
| Paid-preview uniqueness | PASS — 20/20 unique | Distinct SHA-256 values and non-empty files |
| Secret scan | PASS | No real-looking Stripe, webhook, or Resend secret found |
| Cold `npm ci` in this sandbox | BLOCKED | Internal package mirror returns 404 for `youch-core@0.3.3` |
| Dependency-backed `npm run validate:all` | LOCAL RE-RUN REQUIRED | Cannot be truthfully claimed without successful sandbox install |
| Next.js/OpenNext production build | LOCAL RE-RUN REQUIRED | Framework packages unavailable in this sandbox |
| Playwright browser gauntlet | FALLBACK USED | HTTP route/middleware tests and rendered-artifact review used instead |
| Real Stripe test-mode provider session | PROVIDER-GATED | Valid test secrets and price IDs were not exposed to this environment |
| `npm audit` remediation | UNRESOLVED | Local install reported 12 high-severity findings; advisory details were not available here |

## 5. Paid Artifact Inspection

- PDF page counts: budget 11, checklist 13, seating 11, suite 10, timeline 12.
- All 57 PDF pages rendered successfully for visual inspection.
- Four XLSX files passed ZIP/OOXML integrity checks and contained their expected worksheet parts.
- No formula behavior is claimed; the validated workbooks contain zero formula nodes, consistent with the corrected product-page copy.
- All 15 governed delivery files match their canonical manifest hashes.
- All paid deliverables remain outside `public/`.

Machine-readable results: `reports/DREAM_WEDDING_BUILDER_DEEP_VALIDATION_RESULTS_2026-07-30.json`.

## 6. Files Changed in This Corrective Artifact

- `app/api/checkout/route.ts`
- `app/products/[slug]/page.tsx`
- `app/products/operations-suite/page.tsx`
- `app/shop/compare/page.tsx`
- `lib/checkout-contract.ts`
- `lib/products.ts`
- `lib/site-config.ts`
- `lib/__tests__/checkout-route.test.ts`
- `scripts/validate-env.mjs`
- `tests/unit/site-config.test.ts`
- Deep-validation report and machine-readable result files
- Cumulative artifact, scope, implementation-status, and validation-matrix receipts

## 7. Not Changed

- The paid PDF, XLSX, CSV, and suite ZIP contents.
- The 20 authentic paid-product previews.
- The removal of the rejected free-template layer.
- The original `/build` application.
- Product prices, SKUs, fulfillment model, admin model, SEO hubs, 67 guides, canonical host ownership, and 100K authority runway.

## 8. Final Proof Boundary

This correction resolves the concrete TypeScript defects reported by the local updater and adds checkout contract coverage before the next local run. It does not fabricate dependency-backed build proof, Playwright proof, Stripe provider proof, webhook proof, fulfillment proof, deployment proof, or security-audit remediation.

**Artifact state:** `STRUCTURALLY AND DEEPLY CHECKED — DEPENDENCY-BACKED LOCAL VALIDATION REQUIRED`
