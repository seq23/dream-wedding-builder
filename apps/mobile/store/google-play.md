# Google Play listing

**Status (27 Nov 2026):** the app exists in the company Play account (Redwood Reserve Holdings LLC) as Dream
Wedding Builder (`com.weddingchecklistpdf.dreamwedding`), a draft with changes in Google review since 24 Nov
2026 (spry brain). The listing fields to enter are in `store/google-play.json`; the owner or coordinator enters
them in Play Console, never an agent. Console form answers: `store/play-console-answers.md`.

Description: the one text for both stores is `store/app-store-next-version.md` § Description, copied word for
word into `store/google-play.json` (`test/storeFiles.unit.ts` holds them equal). It leaves out "Your partner on
a second phone at no extra cost": partner sharing is switched off in store builds (`EXPO_PUBLIC_DW_SHARING` is
not set in the EAS production environment; read 27 Nov 2026: only the two RevenueCat keys are set there).

## Title (≤ 30) — 21 characters

Dream Wedding Builder

## Short description (≤ 80) — 78 characters

A wedding checklist dated to your day. Free, no account, never a subscription.

## Full description (≤ 4000)

`store/google-play.json` › `full` (2,202 characters), the App Store description word for word. One source, so the two stores never drift.

## Other listing fields

- App category: Lifestyle (suggested) · Contact email: info@weddingchecklistpdf.com
- Website: https://weddingchecklistpdf.com · Privacy policy: https://weddingchecklistpdf.com/privacy

## In-app products (the shared `~/bin/play-products` tool, catalog `scripts/store/play-products.mjs`)

The 5 one-time products are created on Play from the app's own code: ids from the RevenueCat catalog
(`scripts/revenuecat/setup.ts`), USD prices from `PRODUCTS` in `src/billing/offers.ts`, every other region from
Google's own price conversion, titles from `OFFER_NAME`, descriptions from the `play` lines in
`store/in-app-products.json`. The tool lives in seq-bin (`~/bin/play-products`, one copy for every
app); this repo keeps only the catalog. Re-run it after any product change: it creates what is missing (each
product read again just before it is written), activates only drafts, and never deletes, deactivates or
reprices. A different US price on Play prints `MISMATCH`; a product switched off on Play prints `SWITCHED OFF`;
both are left as they are.

**Names and descriptions on Play today (read 27 Nov 2026) differ from the app.** The products were made
before the titles came from the code, and the tool never rewrites a product that exists. Play shows "Full
Plan", "Planner + Printables", "Printables Add-on", "Day-of Kit" and "New Event"; the buy screen says "Full
plan", "Planner + printables", "Printables", "Day-of kit" and "Full plan for a new event". Two descriptions
also promise more than the product holds ("every checklist, budget line and timeline step"; "with its own
checklist, budget and timeline"). The owner or coordinator copies each product's `name` and `play` line from
`store/in-app-products.json` into Play Console (Monetize › One-time products › the product › Listing).

**Consumable or not.** A Play one-time product has no consumable flag of its own: RevenueCat decides, from the
flag it holds. RevenueCat's v2 API keeps every Play one-time product as `type: one_time` and the kind in
`one_time.is_consumable` (the type cannot be written there); what matters is that flag. `dw_new_event` is
consumable (a new event is bought once per event); the other four must be `is_consumable: false` (owned for
good, so restore on a new phone gives them back; a consumed purchase would give nothing back).
`~/bin/revenuecat-setup` checks the flag against `setup.ts` and `--apply` of `~/bin/play-products` refuses to
run while any flag differs.

Read back 27 Nov 2026 (RevenueCat v2, read-only): play_store `dw_full_plan`, `dw_planner_printables`,
`dw_printables_topup`, `dw_day_of_kit` are `one_time`, `is_consumable: false`; `dw_new_event` is `one_time`,
`is_consumable: true`; app_store and test_store hold the four as `non_consumable` and `dw_new_event` as
`consumable`. `revenuecat-setup --dry-run` → "RevenueCat matches the code; nothing changed". They match.

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
- `phone-1.png` to `phone-5.png` — 1080 × 1920 phone screenshots retaken 27 Nov 2026 from the app's web preview of main (the same React Native screens as the store build): start, your wedding on one page (a live AI answer), keep what you love, the dated plan, traditions.
- `feature-graphic.html` — the source of the feature graphic (rendered at 1024 × 500).
