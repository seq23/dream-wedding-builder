# Dream Wedding Builder — Baseline Artifact Manifest

Artifact: `dream-wedding-builder-main_BASELINE_05-24-26_a8c31fd.zip`

## Scope

Full baseline snapshot of the Dream Wedding Builder repo.

## Current pass

This pass implements the approved one-pass planner-grade rebuild around a shared Constraint Profile and Recommendation Studio. It fixes the prior fake-complete risk by requiring user actions, saved state, dashboard/packet reflection, and anti-theater validation for Studio/Matchmaker/Finder-style sections.

## Product architecture locked in this pass

1. Planning Reality Check / Constraint Profile
2. Recommendation Studio
3. Venue + Lodging Matchmaker
4. Budget + Tradeoff Reality
5. Design Direction
6. Florals / Decor / Rentals
7. Fashion / Beauty
8. Food / Beverage
9. Photo / Video / Moments
10. Guest Experience / Hospitality
11. Timeline / Weekend Flow
12. Vendor Team / Inquiry Builder
13. Risk / Reality Checks
14. Planner Packet / Decision Brief

## Usability fixes included

- Step 0 now asks whether the user has hard constraints, flexible constraints, or needs discovery.
- Hard-constraint users can capture destination/location, buyout, onsite sleeping capacity, outside catering, vendor freedom, rain/curfew/accessibility, fixed/flexible/unknowns, budget bands, colors/style, and protected priorities.
- Recommendation Studio is now the first open-ended intelligence module after Step 0.
- Recommendation Studio supports planner bucket focus areas and saves a structured planner output.
- Recommendation Studio outputs planner read, best-fit directions, constraint conflicts, budget implications, vendor questions, next decisions, confidence, and verification caveats.
- Venue + Lodging Matchmaker uses constraints such as Italy, full buyout, sleeping capacity, and outside catering to explain venue fit and conflicts.
- Venue strategies remain selectable and persist to dashboard and packet.
- Budget Reality syncs Step 0 guest count and protects the top three non-negotiables when suggesting savings.
- Build page includes Recommendation Studio CTAs from hero, venue, budget, scope/design, and vendor sections.
- Design Direction, photo/description scope, vendor focus, risk checks, and planner bucket map are all visible and actionable.
- Dashboard reflects constraints, Recommendation Studio output, selected venues, protected priorities, scope, vendors, trends, and risk checks.
- Planner Packet now carries constraint profile, recommendation output, venue/lodging strategy, budget reality, design direction, photo/scope, vendor questions, risk checklist, full bucket map, hidden fees, inquiry draft, and disclaimers.
- Anti-theater validator now checks Studio/Matchmaker/Finder-style sections for interactive markers and Recommendation Studio CTAs.
- E2E gauntlet was expanded to 26 tests covering hard constraints, discovery route, Recommendation Studio, floral recommendation context, venue selection persistence, budget sync, Photos Lab CTAs, vendor selection persistence, trends, and planner packet sections.

## Validation run in container

Passed:

- `npm run typecheck`
- `npm run test`
- `npm run validate:content`
- `npm run validate:env`
- `npm run validate:disclaimers`
- `npm run validate:no-theater`

Partial / blocked:

- `npm run build` compiled successfully and generated static pages, but the container timed out during final build-trace completion. Local validation is required.
- `npm run test:e2e -- --list` passed and listed 26 tests.
- `npm run test:e2e` was blocked in container because the Playwright Chromium browser binary is not installed. Local E2E is required.

## Status

STRUCTURALLY CHECKED — LOCAL VALIDATION REQUIRED
