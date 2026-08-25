# Repo Validation Matrix

| Layer | Command | Severity | Proves | Does Not Prove |
|---|---|---:|---|---|
| TypeScript | npm run typecheck | HARD FAIL | typed app contracts compile | browser behavior |
| Unit | npm run test | HARD FAIL | pure product rules | visual behavior |
| Content | npm run validate:content | HARD FAIL | required routes/data/contracts exist | runtime provider success |
| Env | npm run validate:env | HARD FAIL for enabled provider shape | env contract is documented | secrets are valid |
| Disclaimers | npm run validate:disclaimers | HARD FAIL | required warnings exist | legal sufficiency |
| Anti-theater | npm run validate:no-theater | HARD FAIL | no fake-live/provider theater terms in source | provider accuracy |
| Build | npm run build | HARD FAIL | production build compiles | user journeys |
| E2E Gauntlet | npm run test:e2e:gauntlet | HARD FAIL when browser available | surface/transaction/outcome/common-sense journeys | deployed Cloudflare behavior |
| Headed E2E | npm run test:e2e:headed | Local proof | visible browser testing | CI display unless Xvfb configured |

| Hallmark Visual Review | Manual: UI_QUALITY_GATES.md + screenshots | STRONG WARNING | visual trust, anti-slop risk, CTA hierarchy, mobile sticky-widget sanity | build/runtime/user journeys |
| Numbered Planning Steps | Manual/structural review of app/build/page.tsx | HARD FAIL if removed | Step 0 through Step 7 remain visible and linkable in the build flow | visual polish or runtime interaction depth |

## July 22, 2026 Proof-Readiness Validation Split

Validation profiles check contracts and structural evidence. They do not generate authority artifacts, generate product downloads, run provider bootstrap, deploy, submit provider data, or run a production build.

| Layer | Command | Severity | Proves | Does Not Prove |
|---|---|---:|---|---|
| Validation profile purity | npm run validate:profile-purity | HARD FAIL | validate scripts are read/check-only | whether execution commands work |
| Tree hygiene | npm run validate:tree-hygiene | HARD FAIL | ZIP source excludes dependency/runtime/build debris | visual quality |
| Proof readiness | npm run validate:proof-readiness | HARD FAIL | existing authority receipts, product files, provider-proof boundary, protected admin actions, and Day-0 links are coherent | live provider success |
| No internal instruction leak | npm run validate:no-instruction-leak | HARD FAIL | no reader-facing surface renders external-agent build directives (`FILEPATH:`, `\|\| CURRENT/MISSING/EDIT:`, citation-ready update text) | that generated copy is otherwise good |
| No empty table cells | npm run validate:no-empty-cells | HARD FAIL | no reader-facing surface emits a literal empty `<td>`/`<th>`, so table columns stay aligned with their headers | cells whose content is a runtime expression |
| Structural validation | npm run validate:structural | HARD FAIL for important source/contract breakage | content, env, disclaimer, anti-theater, no-stub, commerce, authority, download, secret, admin, proof, and artifact-shape contracts | production build and browser behavior |
| Local all validation | npm run validate:all | HARD FAIL | typecheck, unit tests, and structural validation pass | authority regeneration, production build, deployed provider proof |
| Explicit local full proof | npm run proof:local-full | HARD FAIL when run intentionally | typecheck, unit tests, authority generation, structural validation, and production build | live Stripe, R2, D1, Resend, GSC, IndexNow, ranking, or citation proof |

### Execution Commands Are Not Validators

- `npm run authority:all` writes authority receipts and sitemaps.
- `python scripts/generate_product_downloads.py` writes product release files.
- `npm run build` writes framework build output.
- `npm run stripe:bootstrap:*`, `npm run cloudflare:discover`, `npm run d1:migrate:remote`, `npm run deploy`, and `npm run upload` touch providers or deployment surfaces.

Those commands remain explicit proof/release actions.

## Deep-Validation Fallbacks — 2026-07-30

These fallbacks may isolate source defects when the validation container cannot install locked dependencies. They supplement but do not replace the local release gates.

| Layer | Fallback | Result in corrective phase | Does not prove |
|---|---|---:|---|
| TypeScript relationships | strict full-source check with external module declarations | PASS | real Next/React library API compatibility |
| Core contracts | strict product/host/checkout compilation | PASS | framework build |
| Checkout | actual route with synthetic env values and mocked Stripe response | PASS | provider-side session, charge, webhook, fulfillment |
| Canonical routing | middleware HTTP matrix with Next request/response shim | PASS | deployed Cloudflare/browser behavior |
| Browser/artifact view | PDF render and all-page contact review | PASS | web UI Playwright journeys |

The hard release sequence remains `npm run validate:all`, production build, and the configured browser gauntlet in an environment with the locked dependency graph installed.


## Search Visibility Autonomy — 2026-08-08

| Layer | Command | Severity | Proves | Does Not Prove |
|---|---|---:|---|---|
| Search intelligence truth contract | `npm run validate:search-intelligence` | HARD FAIL | target ownership, provider evidence classes, bounded repair types, anti-overclaim boundaries, and outcome states are structurally valid | live rankings, competitor universality, indexing, citations, or conversions |
| Search intelligence cycle | `npm run search:cycle` | BOUNDED EXECUTION | target generation, configured GSC collection, diagnosis, safe metadata repair, delayed retest, and status output execute as a separate lane | provider availability when credentials are absent |

Search intelligence is deliberately outside the existing authority publication cadence. It may repair approved hub metadata but may not create URLs, change canonical ownership, or alter velocity.
