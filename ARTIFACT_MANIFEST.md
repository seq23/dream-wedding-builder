# Dream Wedding Builder Baseline Artifact

Artifact: `dream-wedding-builder-main_BASELINE_05-24-26_b7f4a6d.zip`

## Repo identity

- Repo: `dream-wedding-builder`
- Branch target: `main`
- Framework: Next.js + TypeScript + Tailwind
- Deployment target: Cloudflare Pages

## Major changes

- Added locked master product plan in `docs/product-master-plan.md`.
- Rebuilt `/build` as a bride-led planning intelligence workspace.
- Added Step 1 Vibe + Theme Translator for freeform wording, photos, inspiration notes, and guided prompts.
- Added Photo/Description-to-Scope Intelligence for tablescapes, bouquets, flowers, flower girl dresses, attire, decor, stationery, and typed descriptions.
- Added structured scope data in `data/inspiration.ts` and expanded `data/planning.ts`.
- Expanded `/photos`, `/dashboard`, and `/pack` to carry scope, confidence, source trace, vendor questions, and verification caveats.
- Hardened content and no-theater validators.
- Expanded Playwright E2E persona/flow coverage.

## Validation performed in assistant container

Passed before packaging:

- `npm ci`
- `npm run typecheck`
- `npm run test`
- `npm run validate:content`
- `npm run validate:env`
- `npm run validate:disclaimers`
- `npm run validate:no-theater`

Build status:

- `npm run build` compiled successfully and generated static pages, then the container timed out during Next.js finalization/build trace collection.
- Local validation is required on the user's machine before commit/push/deploy.

## Artifact status

STRUCTURALLY CHECKED — LOCAL VALIDATION REQUIRED
