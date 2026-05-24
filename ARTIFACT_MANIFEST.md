# Artifact Manifest — Dream Wedding Builder

Artifact type: full baseline snapshot
Repo: dream-wedding-builder
Date: 05-24-26
Revision: guided workbook V2

## Included
- Next.js + TypeScript + Tailwind app
- Guided long-scroll `/build` workbook with Step 1–7 flow
- Supporting pages: dashboard, trends, photos, pack, disclaimer, privacy, methodology
- Wedding Trend Concierge embedded in workbook plus standalone library
- Photo consent and retail-vs-execution cost distinction
- Strict Budget Mode warning and escape hatches
- Printable Dream Wedding Starter Pack
- Unit tests, validators, and Playwright E2E gauntlet

## Important corrections in this artifact
- Removed Linux-only Playwright Chromium path.
- Updated E2E locators for strict Playwright mode.
- Converted primary UX from siloed navigation to guided bridal workbook.
- Rewrote package-lock resolved URLs away from container-only internal registry paths.

## Status
Structurally checked in container. Local validation still required after applying to the user's repo.
