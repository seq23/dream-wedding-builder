# Zero paid LLM — dream-wedding-builder

Owner policy, 11 Oct 2026: "nothing should be paid … cut the probes and make them free."

## What was paid

| Call site | Ran from | How often | Model | What it did |
|---|---|---|---|---|
| `scripts/search_intelligence/llm_citation_probe.mjs` (`npm run search:citations`) | `search:cycle` in `search-intelligence.yml` | Scheduled daily at 11:41 UTC, but throttled to one measured run every 168 h; 13 queries × 5 web results | `openai/gpt-4o-mini` + OpenRouter web plugin (parallel/turbo, billed per web result) | Answer-engine citation occupancy: which sites are cited for our queries. Observes/scores the loop's own output. |

No content generation, rewriting, classification or outreach in this repo calls a model. The app runtime (`app/`, `lib/`, `worker.ts`) makes no model calls. Authority pages are template-driven, and publishing is held by the measured-demand gate.

## Now

- **The probe is off.** It is out of `search:cycle` and on no schedule. It moved to `citation-probe.yml` and runs only when someone dispatches it by hand with `confirm_paid: true`. Any other dispatch is the named stop `PAID_LANE_REFUSED`. The script also refuses on its own when `CONFIRM_PAID` is not `true` (exit 0, receipt, no network call). `npm run search:status` reports `citation_probe=DISABLED_OWNER_POLICY`, which counts as healthy.
- **Every model call goes through the free router**, `scripts/llm/free_router.mjs`. It reads `config/llm_routing.json`, where `max_cost_usd: 0` is a hard policy. The router tries only the listed $0 models, in order (snapshot dated in the file). It adds OpenRouter `provider.max_price` 0 and never falls back to a paid model. If no free model answers, it returns a named stop and generates nothing. A non-zero `usage.cost`, or an answer from a model that is not on the list, throws and fails the run.
- **The daily cycle checks the router.** `search-intelligence.yml` runs `npm run llm:check`. It confirms live pricing is still $0, then sends one free ping. Its receipt is the log line `LLM_ROUTER_RECEIPT`. A key that is disabled or invalid gives the named stop `CREDENTIAL_REFUSED`, and the cycle stays green.
- **The guard is `validate:zero-paid-llm`**, part of `validate:structural` and registered HARD_FAIL in `_repo_validation_registry.json`.

## Refreshing the free list

Fetch `https://openrouter.ai/api/v1/models` (no key). Keep models where `pricing.prompt == "0" && pricing.completion == "0"` and the context is at least 32k. Update `models` and `pricing_snapshot` in `config/llm_routing.json`. If a configured model turns paid, `llm:check` fails loudly.
