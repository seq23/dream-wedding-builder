# Dream Wedding Builder — Master Product + Architecture Plan

## Product identity

Dream Wedding Builder is not a preset wedding workbook. It is a bride-led wedding planning intelligence system for users who may know everything, know almost nothing, or only have fragments from photos, Pinterest boards, family pressure, budget anxiety, or vague language.

The app must behave like a veteran wedding planner plus senior software system: calm intake, canonical state, honest data trace, source/confidence labels, contradiction detection, budget reality, vendor strategy, and planner-ready output.

## Locked operating principle

User constraints first → real/structured/current data where available → confidence labels → LLM/planner reasoning → ranked recommendation → warnings → next actions → verification checklist.

The app must not invent prices, live availability, vendor facts, venue packages, product matches, timelines, or certainty because it has LLM capability.

## Required master modules

1. Blank-start guided intake
2. Vibe + Theme Translator
3. Budget Reality Engine
4. Venue Finder / Matchmaker
5. Vendor Finder / Vendor Intelligence
6. Photo/Description-to-Scope Intelligence
7. Tablescape Decoder
8. Bouquet + Floral Scope Builder
9. Flower Girl Dress / Attire Finder Strategy
10. Hidden Fee Intelligence
11. Inspiration Templates as optional inspiration only
12. Trend Concierge with no preselected trends
13. Planner Packet Export
14. Source Trace + Confidence Labels
15. No-Theater Validators and persona E2E

## Step 1 — Vibe + Theme Translator

Step 1 must accept:

- freeform bride wording
- uploaded photos
- Pinterest-style inspiration notes
- tablescape photos
- bouquet/flower photos
- dress/attire photos
- venue photos
- stationery/decor photos
- mixed photo + text input
- “I do not know yet” guided prompts

It must translate messy input into:

- likely wedding direction
- secondary direction
- words to use with vendors
- words to avoid
- color/material/floral/venue implications
- fashion implications
- photography direction
- guest experience direction
- budget implications
- verification needs
- planner-ready summary

Presets are never active state. They are inspiration templates only.

## Venue Finder standard

A bride should be able to say: “Charleston, 90 guests, under $65k, elegant coastal garden.” The system should return venue strategy or candidates only if data exists, with:

- source URLs or source labels
- last verified date when available
- capacity fit
- style fit
- budget fit
- site fee/F&B/all-in assumptions where sourced
- hidden fee warnings
- inquiry questions
- confidence labels
- “verify directly” requirements

No exact venue pricing or availability may be claimed without real source data.

## Every major planning category uses the same pattern

Venues, planners, photographers, florists, catering, rentals, lighting, attire, stationery, transportation, hotel blocks, travel, welcome parties, rehearsal dinners, after parties, rain plans, family/cultural needs, and timelines all use:

Constraint → data → confidence → reasoning → warnings → next actions → verification.

## Photo/Description-to-Scope Intelligence

A bride can upload a photo or type a description for:

- tablescapes
- bouquets
- flowers
- centerpieces
- ceremony arches
- reception rooms
- flower girl dresses
- bridesmaid dresses
- bridal fashion
- stationery
- menus/place cards
- chairs/linens/rentals
- candles/chandeliers/lighting
- decor moments

The app converts inspiration into:

- detected/requested components
- likely hidden components
- missing context questions
- quantity assumptions
- cost ranges
- vendor categories
- sourcing/search strategy
- inquiry emails
- confidence labels
- source trace
- warnings

Typed descriptions receive the same treatment as images.

## Tablescape Decoder standard

A photo or description such as long tables, lace cloths, candles, chandeliers, chairs with bows, flowers, and layered tabletop must become:

- table count estimate based on guest count
- line-item components
- per-table/per-guest/flat-fee quantity basis
- florist/rental/linen/lighting/stationery/planner vendor map
- hidden costs: open flame, rigging, delivery, setup, strike, damage waiver, linen steaming, minimums
- inquiry packet for each vendor category
- verification checklist

## Bouquet/Flower standard

Bouquet or flower inspiration must become:

- possible bloom IDs with caution
- palette
- shape/size/density
- seasonal substitutions
- premium flower risk
- bride bouquet estimate range
- bridal party and personal flower implications
- ceremony/reception floral implications
- florist inquiry packet

The app must say possible flower ID, not guaranteed.

## Flower girl dress / attire standard

Dress inspiration must become:

- silhouette/fabric/sleeve/length/color/bow details
- age/size suitability
- search terms
- price bands
- retailer strategy
- alteration and shipping warnings
- return policy checklist
- verification steps

No exact product match without real retail data.

## Canonical state requirement

Everything derives from one canonical WeddingPlan object. The app must not show one guest count in one section and another in another section. Pack, dashboard, builder, venue finder, budget, and scope output must all read from the same plan state.

## Required validation philosophy

Hard-fail if:

- Lake Como appears as active state before selection
- selected trends exist on first load
- guest count differs across sections
- pack includes unchosen assumptions
- venue price appears without confidence/source language
- vendor recommendation appears without caveat
- product match appears without verification language
- chandelier pricing appears without rigging warning
- floral pricing appears without table count / guest count caveat
- app claims availability
- app claims it contacted anyone
- app implies LLM knows current pricing without data

## V1 implementation posture

Current V1 is allowed to use seeded examples and static scope intelligence as long as the UI says so clearly. Future versions can add admin CSV/JSON data, source URLs, last verified dates, real vendor/venue datasets, uploaded PDF/proposal extraction, and live research integrations.
