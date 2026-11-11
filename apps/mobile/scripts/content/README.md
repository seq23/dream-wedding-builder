# Private content leak check

`npm run check` runs `test/paidContent.unit.ts` against every Git-tracked repository
file, including the mobile source and assets. It fails on a complete private task
match after normalizing case, punctuation, whitespace and escaped line breaks.
Binary files are excluded; this is a text-copy guard, not OCR or archive inspection.
Tests use fictional text to prove both refusal and acceptance. A missing, empty or
malformed fingerprint manifest fails the check.

`fingerprints.json` contains SHA-256 fingerprints of the private full-plan tasks
and seven tradition packs. It contains no paid wording. The free core tasks,
locked-row teasers and each pack's one bundled example are excluded during
generation from their actual source modules. No runtime download is affected.

Refresh from `apps/mobile` whenever private product text changes:

```sh
npx tsx scripts/content/refresh.ts ~/.boss-os/dream-wedding
npm run check
```

The generator fails when any of the eight source files is missing, empty or
invalid. Source files are `full-plan-tasks.json` and
`tradition-packs/<id>.json` in that private folder. R2 keys are
`plans/checklist-full-plan-v1.json` and `packs/traditions/<id>-v1.json` in
`dream-wedding-builder-products`. Refresh fingerprints in the same release as
private text changes; CI checks the committed snapshot without private access.

Printable and day-of archive text is **NOT RUN** and is printed as such on every
check. The coordinator must supply the private files
`~/.boss-os/dream-wedding/app/printables-v1.zip` and
`~/.boss-os/dream-wedding/app/day-of-kit-v1.zip`, for bucket keys
`app/printables-v1.zip` and `app/day-of-kit-v1.zip`. Their extracted paid text
still needs fingerprints when those products exist. This check does not claim
coverage of those absent files, images, encrypted files, or compiled archives.
