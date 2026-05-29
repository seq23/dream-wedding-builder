# Artifact Manifest — Dream Wedding Builder

## Artifact
- Repo: dream-wedding-builder
- Package type: full baseline snapshot
- Branch assumption: main
- Date: 2026-05-29
- Scope: Hallmark + Hostile UX redesign execution

## Changed Surfaces
- `app/page.tsx`
- `app/build/page.tsx`
- `components/StickyTotal.tsx`
- `DESIGN_SYSTEM.md`
- `REPO_VISUAL_STYLE_GUIDE.md`
- `UI_QUALITY_GATES.md`
- `REPO_VALIDATION_MATRIX.md`
- `ARTIFACT_MANIFEST.md`

## Design Changes
- Reframed homepage toward luxury planner notebook + intelligent bridal concierge.
- Added planner-packet preview and above-fold trust markers.
- Reduced homepage CTA hierarchy to primary Planning Reality Check and secondary Recommendation Studio.
- Preserved explicit Step 0 through Step 7 structure in build flow.
- Reworked build flow language toward guided planner desk while retaining existing validation-required product terms.
- Added visible trust markers: seeded examples only, no live availability claimed, verify before booking, confidence labels, packet records assumptions.
- Changed mobile sticky estimate behavior: estimate widget is desktop-only so mobile has one bottom fixed system.

## Validation Run
- `npm ci`: passed.
- `npm run typecheck`: passed as part of `npm run validate:all` before build phase.
- `npm run test`: passed, 3 tests.
- `npm run validate:content`: passed.
- `npm run validate:env`: passed.
- `npm run validate:disclaimers`: passed.
- `npm run validate:no-theater`: passed.
- `npm run build`: compiled successfully, generated static pages, then sandbox command timed out during final build trace collection. Local validation should rerun through updater.

## Unproven Layers
- Playwright E2E not run in this sandbox.
- Deployed Cloudflare smoke not run.
- Human visual review not proven.
- GitHub Actions not checked.

## Status
STRUCTURALLY CHECKED — LOCAL VALIDATION REQUIRED
