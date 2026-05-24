# Dream Wedding Builder — Product Master Plan

## Product posture
Dream Wedding Builder is a free, no-login, mobile-first web planner that turns a bride's rough dream wedding into a calm, guided starter plan.

## V2 architecture decision
The primary user journey is no longer a siloed dashboard navigation experience. The core product is a single guided scrolling workbook at `/build`.

Supporting routes remain available, but they are secondary:
- `/build` — primary guided workbook and main product experience
- `/dashboard` — summary/reference view after saving a plan
- `/trends` — deeper Wedding Trend Concierge library and submission intake
- `/photos` — standalone photo-pricing support page
- `/pack` — printable Dream Wedding Starter Pack

## Guided workbook steps
1. Vision — turn vague wedding taste into planner/vendor language.
2. Budget — choose No Budget, Flexible Range, or Strict Budget Mode.
3. Priorities — protect the top three non-negotiables.
4. Trends — choose signature moments inside the workbook.
5. Photo — upload inspiration only after consent and cost-context warnings.
6. Pricing — compare Cheapest Possible, Best Value, Best Fit, and Luxury paths.
7. Packet — generate a planner-ready Dream Wedding Starter Pack.

## Design intent
The app should feel like a premium bridal workbook, not generic SaaS. It should use explicit instructions, step labels, warm editorial design, sticky progress/estimate cues, and plain-language warnings.

## Safety and truth posture
- No fake live vendor search.
- No fake product availability.
- No claim that retail item cost equals wedding execution cost.
- No photo analysis without consent.
- Estimates are planning estimates only.
- Strict Budget Mode warns and reconciles; it does not trap.
