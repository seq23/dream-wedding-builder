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

## In-app products (the shared `~/bin/play-products` tool, catalog `scripts/store/play-products.mjs`)

The 5 one-time products are created on Play from the app's own code: ids from the RevenueCat catalog
(`scripts/revenuecat/setup.ts`), USD prices from `PRODUCTS` in `src/billing/offers.ts`, every other region from
Google's own price conversion, titles from `OFFER_NAME`, descriptions from the App Store texts in
`store/paid-files.json` (or `OFFER_DETAIL`). The tool lives in seq-bin (`~/bin/play-products`, one copy for every
app); this repo keeps only the catalog. Re-run it after any product change: it creates what is missing (each
product read again just before it is written), activates only drafts, and never deletes, deactivates or
reprices. A different US price on Play prints `MISMATCH`; a product switched off on Play prints `SWITCHED OFF`;
both are left as they are.

**Consumable or not.** A Play one-time product has no consumable flag of its own: RevenueCat decides, from the
product type it holds. `dw_new_event` is `consumable` there on every store (a new event is bought once per
event); the other four are `non_consumable` (owned for good, restored on a new phone). Never `one_time`: on Play
RevenueCat consumes such a purchase, so restore would give nothing back. `~/bin/revenuecat-setup` sets and
checks the types from `setup.ts`.

**Launch price.** `dw_full_plan` is $14.99; its $9.99 launch price for the first 30 days is a Play discount
offer (`launch`) on the product, made by the same tool from `LAUNCH_OFFER` in `src/billing/offers.ts`. Until
`LAUNCH_OFFER.startTime` holds the Play launch date, the tool prints `WAITING` and creates nothing; set the date
in the code when the listing goes live and re-run with `--apply`. Each region gets the same share off.

```
cd ~/GitHub/boss-os && npm run -s vault:run -- ~/bin/play-products ~/GitHub/dream-wedding-builder/apps/mobile/scripts/store/play-products.mjs           # dry run: the plan
cd ~/GitHub/boss-os && npm run -s vault:run -- ~/bin/play-products ~/GitHub/dream-wedding-builder/apps/mobile/scripts/store/play-products.mjs --apply   # create, activate, read back
```

`--apply` writes nothing while RevenueCat still holds any of these products on Play with another type
(`NAMED STOP [RC_TYPES_NOT_READY]`: a sale would be consumed); run `~/bin/revenuecat-setup` first.

Exit 0 means Play matches; 3 means a dry run with work left; 1 a failure or mismatch; 2 a named stop. Done
means the `--apply` run ends `read-back on <package>: 5/5 active …` and a dry run after it exits 0. A failure
(401/403, 429, 5xx, network) stops every write and prints Google's answer; re-run once it clears.
`NAMED STOP [PLAY_PERMISSION_DENIED]`: the service account in `GOOGLE_PLAY_UPLOAD_SA_JSON` lacks "Manage store
presence" on this app in Play Console (a new grant can take up to 36 hours to reach the API). Tests: the
catalog in `test/playProducts.unit.ts`, the tool in seq-bin `tests/store/`.

## Graphics (in `store/google-play/`)

- `icon-512.png` — 512 × 512 app icon (same mark as the app icon).
- `feature-graphic.png` — 1024 × 500.
- `phone-1.png` to `phone-5.png` — 1080 × 1920 phone screenshots from the free web preview of the app (19 Nov 2026): start, your wedding on one page (a live AI answer), keep what you love, the dated plan, traditions. Retake from the Android build before submission if anything differs.
- `feature-graphic.html` — the source of the feature graphic (rendered at 1024 × 500).
