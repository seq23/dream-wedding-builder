# Google Play listing — DRAFT, NOT FOR SUBMISSION

**Status: DRAFT (19 Nov 2026; description rewritten 21 Nov 2026).** Store copy was held on purpose until the launch plan. This is
drafted for her to see first; nothing here goes to Google until she has read it and the company
Play account (Redwood Reserve Holdings LLC; exists, organisation documents and website in
review on 19 Nov 2026) is cleared to publish. Console form answers: `store/play-console-answers.md`.

Description: the one text for both stores is `store/app-store-next-version.md` § Description, with
its promise table (rewritten 21 Nov 2026 to answer what, who and the price model first). It already
leaves out "Your partner on a second phone at no extra cost": partner sharing is switched off in store
builds (`EXPO_PUBLIC_DW_SHARING` is not set in the EAS production environment).

## Title (≤ 30) — 21 characters

Dream Wedding Builder

## Short description (≤ 80) — 78 characters

A wedding checklist dated to your day. Free, no account, never a subscription.

## Full description (≤ 4000)

Paste `store/app-store-next-version.md` § Description (2,119 characters). One source, so the two stores never drift.

## Other listing fields

- App category: Lifestyle (suggested) · Contact email: info@weddingchecklistpdf.com
- Website: https://weddingchecklistpdf.com · Privacy policy: https://weddingchecklistpdf.com/privacy

## In-app products (made by `scripts/store/play-products.mjs`)

The 5 one-time products are created on Play from the app's own code: ids from the RevenueCat catalog
(`scripts/revenuecat/setup.ts`), USD prices from `PRODUCTS` in `src/billing/offers.ts` (`dw_full_plan` at its
$14.99 list price; the $9.99 launch price is a scheduled price change, made by hand), every other region from
Google's own price conversion, titles from `OFFER_NAME`, descriptions from the App Store texts in
`store/paid-files.json` (or `OFFER_DETAIL`). Play has no consumable flag: RevenueCat holds `dw_new_event` as a consumable (`setup.ts`) and consumes it after
each purchase. Re-run it after any product change; it only creates what is missing and activates what is not
active, never deletes, deactivates or reprices (a different price on Play prints `MISMATCH`).

```
cd ~/GitHub/boss-os && npm run -s vault:run -- npx --prefix ~/GitHub/dream-wedding-builder/apps/mobile tsx ~/GitHub/dream-wedding-builder/apps/mobile/scripts/store/play-products.mjs           # dry run: the plan
cd ~/GitHub/boss-os && npm run -s vault:run -- npx --prefix ~/GitHub/dream-wedding-builder/apps/mobile tsx ~/GitHub/dream-wedding-builder/apps/mobile/scripts/store/play-products.mjs --apply   # create, activate, read back
```

Done means the last line reads `read-back 5/5 active, 0 mismatches, 0 named stops`, and a dry run after it
plans `0 to create, 0 to activate`. `NAMED STOP [PLAY_PERMISSION_DENIED]`: the service account in
`GOOGLE_PLAY_UPLOAD_SA_JSON` lacks "Manage store presence" on this app in Play Console (a new grant can take up to
36 hours to reach the API). Tests: `test/playProducts.unit.ts`.

## Graphics (in `store/google-play/`)

- `icon-512.png` — 512 × 512 app icon (same mark as the app icon).
- `feature-graphic.png` — 1024 × 500.
- `phone-1.png` to `phone-5.png` — 1080 × 1920 phone screenshots from the free web preview of the app (19 Nov 2026): start, your wedding on one page (a live AI answer), keep what you love, the dated plan, traditions. Retake from the Android build before submission if anything differs.
- `feature-graphic.html` — the source of the feature graphic (rendered at 1024 × 500).
