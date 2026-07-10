# Dream Wedding Builder — Hostile Repair Implementation Plan

## Architecture decision

Option B is locked. `weddingchecklistpdf.com` is the parent application host. The root route is the free Dream Wedding Builder hub. `/products/checklist-pdf` is the paid Checklist flagship and commercial authority destination on the same host. The other three paid products retain their own canonical domains.

## Phase 1 — Canonical and search repair

- Replace the unresolved parent-domain token.
- Enforce root-versus-checklist query ownership.
- Generate host-aware canonicals, sitemaps, LLM files, and internal links.
- Reject stale ApprovalPrep Search Console properties.

## Phase 2 — Password-only admin repair

- Keep one password field only.
- Remove `ADMIN_USERNAME` from examples, docs, validators, and UI.
- Preserve server-side password hashing, signed sessions, origin checks, and audit receipts.

## Phase 3 — Product lifecycle completion

- Create and edit products.
- Stage versioned releases with SHA-256 receipts.
- Support local staging and confirmed-private GitHub storage until R2 is bound.
- Activate, pause, revoke, archive, and guarded-delete drafts.
- Preserve historical product, price, order, and entitlement records.

## Phase 4 — Product visual completion

- Generate interior screenshots from real customer files.
- Add three interior previews per hero product.
- Keep hero, card, and Suite images fitted to explicit ratios.
- Validate dimensions, product ownership, alt text, and paid-file exposure.

## Phase 5 — Cloudflare discovery and provisioning

- Discover Pages, D1, and R2 through authenticated Cloudflare APIs/Wrangler.
- Bind existing resources or create only missing resources during the provider phase.
- Store generated identifiers in non-secret provider receipts.

## Phase 6 — Commerce persistence and fulfillment

- Add D1 orders, webhook events, entitlements, refunds, and chargebacks.
- Add private R2 releases and signed download access.
- Add Resend purchase, delivery, recovery, replacement, and revocation notices.
- Prove Stripe test checkout through protected download.

## Phase 7 — Authority automation proof

- Ingest live query and performance signals.
- Keep 85–90% of factory attention on the four paid flagship pages.
- Generate, validate, repair, publish, distribute, measure, and refresh with receipts.
- Keep observed citations separate from owned surfaces and opportunities.

## Phase 8 — Hostile end-to-end proof

- Browser, mobile, accessibility, admin, commerce, upload, rollback, authority, and failure journeys.
- No capability advances beyond its proven state.
