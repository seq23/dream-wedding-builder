# Zero paid LLM — dream-wedding-builder

Owner policy, 11 Oct 2026: "nothing should be paid … cut the probes and make them free."

## What was paid

| Call site | Ran from | How often | Model | What it did |
|---|---|---|---|---|
| `scripts/search_intelligence/llm_citation_probe.mjs` (`npm run search:citations`) | `search:cycle` in `search-intelligence.yml` | Scheduled daily at 11:41 UTC, but throttled to one measured run every 168 h; 13 queries × 5 web results | `openai/gpt-4o-mini` + OpenRouter web plugin (parallel/turbo, billed per web result) | Answer-engine citation occupancy: which sites are cited for our queries. Observes/scores the loop's own output. |

No content generation, rewriting, classification or outreach in this repo calls a model. The one model call in the app runtime is the Builder's AI draft (below). Authority pages are template-driven, and publishing is held by the measured-demand gate.

## Now

- **The probe is off.** It is out of `search:cycle` and on no schedule. It moved to `citation-probe.yml` and runs only when someone dispatches it by hand with `confirm_paid: true`. Any other dispatch is the named stop `PAID_LANE_REFUSED`. The script also refuses on its own when `CONFIRM_PAID` is not `true` (exit 0, receipt, no network call). `npm run search:status` reports `citation_probe=DISABLED_OWNER_POLICY`, which counts as healthy.
- **Every model call goes through the free router**, `scripts/llm/free_router.mjs`. It reads `config/llm_routing.json`, where `max_cost_usd: 0` is a hard policy. The router tries only the listed $0 models, in order (snapshot dated in the file). It adds OpenRouter `provider.max_price` 0 and never falls back to a paid model. If no free model answers, it returns a named stop and generates nothing. A non-zero `usage.cost`, or an answer from a model that is not on the list, throws and fails the run.
- **The daily cycle checks the router.** `search-intelligence.yml` runs `npm run llm:check`. It confirms live pricing is still $0, then sends one free ping. Its receipt is the log line `LLM_ROUTER_RECEIPT`. A key that is disabled or invalid gives the named stop `CREDENTIAL_REFUSED`, and the cycle stays green.
- **The guard is `validate:zero-paid-llm`**, part of `validate:structural` and registered HARD_FAIL in `_repo_validation_registry.json`.

## The Builder's AI draft (10 Nov 2026: thousands a day, $0, Gemini added)

`lib/ai-draft.ts` runs a $0 chain, every model call through the router:

1. **Gemini API free tier** (`gemma-4-31b-it`, `gemini-3.5-flash-lite`, `gemini-flash-latest`), key `GEMINI_API_KEY` (Worker secret, `x-goog-api-key` header, server only). Router: `callGemini`.
2. **OpenRouter `:free` models** as above (`routeChat` with `onlyModels`, one at a time so each is counted).
3. **Rules parser** (`lib/ai-draft-rules.ts`): no model, unlimited. The response says "Filled from your sentence without AI. Check each field."
4. **The plain form** when nothing can be read.

- **Billing guard (proves Gemini is $0):** once per Central day, before the first Gemini call, `probeGeminiBilling` asks `gemini-pro-latest` (no free tier) for one token. 429 "exceeded your current quota" = free tier, no billing. 200 = `NAMED STOP [GEMINI_BILLING_ATTACHED]` and no Gemini call that day. Anything else = not proven: Gemini skipped, probe retried after 15 minutes. Cached in D1 `ai_route_usage`.
- **Measured capacity (14 Nov 2026): about 650 to 700 free AI answers a day**, not the sum of the ceilings. How it was measured and the per-model numbers are in `config/llm_routing.json` `capacity.measured`: gemini-3.5-flash-lite does nearly all the work (1,000 a day per Google project, ceiling 800, about 85% pass our checks); gemma-4-31b gave nothing that day (HTTP 500) and is tried last; gemini-flash-latest is 20 a day per project; OpenRouter's 1,000 a day is shared by the whole account. Repeat "I don't know yet" answers come from a 7-day cache keyed by her taps (`wedding_read_cache`) for no call; test traffic never writes to it.
- **Ceilings:** `config/llm_routing.json` `capacity.pools`, each 80% of the free limit, per provider day (Gemini resets at Pacific midnight, OpenRouter at UTC midnight) and per minute, counted atomically in D1. A 429 moves on at once; a daily-quota 429 marks the pool spent for its day. Google no longer prints per-model free limits (read 10 Nov 2026: shown only in AI Studio, per project), so the Gemini numbers are marked assumed with their basis; confirm them in AI Studio and edit `rpd`, `ceiling_day` there.
- **Consent:** the card's required tick box (`AI_CONSENT_TEXT` in `lib/builder-signup.ts`) names Google Gemini and OpenRouter and says the model may keep it; without it the server asks no model.
- **Load check:** `npm run load:ai-draft` (CI) replays 3,000 drafts with mocked providers: quotas, 429s, billing attached, all down.

## Refreshing the free list

Fetch `https://openrouter.ai/api/v1/models` (no key). Keep models where `pricing.prompt == "0" && pricing.completion == "0"` and the context is at least 32k. Update `models` and `pricing_snapshot` in `config/llm_routing.json`. If a configured model turns paid, `llm:check` fails loudly.
