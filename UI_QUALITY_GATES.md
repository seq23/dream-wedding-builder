# UI Quality Gates

## Status
ACTIVE — STRONG WARNING unless usability/conversion-critical failure exists.

## Hallmark Visual Review Gate
Before major UI release, inspect:

1. Does the page look like a default AI-generated app?
2. Does the page visually communicate bridal trust?
3. Is the primary action obvious?
4. Is the numbered planning sequence preserved?
5. Does the design feel premium enough for a wedding-planning product?
6. Are trust markers visible before users make planning decisions?
7. Are unknown states calm and planner-like?
8. Does mobile avoid competing sticky widgets?
9. Are seeded-data and no-live-availability limits clear?
10. Does the Planner Packet feel like the product outcome?

## Required Screenshot Review
For UI redesign work, capture or inspect:
- homepage desktop
- homepage mobile
- build page desktop
- build page mobile
- planner packet route if changed

## Severity
HARD FAIL only if:
- CTA is unusable
- mobile blocks critical actions
- page crashes or is blank
- product claims live data it does not have
- trust disclaimers disappear
- numbered planning steps are removed from build flow

STRONG WARNING if:
- interface feels generic
- visual hierarchy is weak
- card-grid repetition dominates
- trust markers exist but are visually buried
- premium positioning is unsupported by design

WARNING if:
- copy polish is needed
- spacing could be improved
- optional visual richness is missing

## Completion Rule
Visual artifacts generated do not equal human visual approval. Mark screenshot proof as visual artifacts generated unless reviewed.
