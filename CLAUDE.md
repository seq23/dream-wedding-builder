# Dream Wedding Builder — working rules

Repo authority order is in `AGENTS.md`; read that first. This file carries the rules
an agent must not have to discover, and every one of them is read by something that
fails when it is broken.

## Cost: nothing paid

**Nothing paid.** Every model, search and enrichment call in this repository goes
through the $0 router (`scripts/llm/free_router.mjs`) against OpenRouter's free
models, with `max_cost_usd: 0` and no paid fallback. When no free model answers, the
run makes a NAMED STOP with a receipt and generates nothing — it never falls back to
a priced model, and it never "just this once" spends.

- The policy, the measurement behind it and the escape hatch are in
  [`docs/cost/zero-paid-llm.md`](docs/cost/zero-paid-llm.md).
- The machine-readable policy is `config/llm_routing.json` (`policy.max_cost_usd: 0`,
  `paid_fallback: false`).
- `npm run validate:zero-paid-llm` (HARD_FAIL in `_repo_validation_registry.json`)
  reads this file, that doc and that config, walks every code file and every
  workflow, and fails if any of them can reach a paid provider. A paid lane exists
  only as a declared `paid_lanes` entry that is unscheduled and gated on
  `confirm_paid`.

Deleting the line above does not relax the rule; it fails the validator.

## Publishing and search

- `data/seo/route_ownership.json` is the one list of hosts and routes. Four canonical
  domains are served by one Worker; a route belongs to exactly one host and the
  middleware redirects it there, so an internal link must be emitted with
  `hrefFrom()` and never left to resolve against the current host.
- Titles are 30–65 characters and meta descriptions 120–160, on every page, for every
  user agent. `npm run validate:rendered-seo` boots the build and asserts it against
  every sitemap URL, together with the structured-data frame (a complete
  `Organization`, a `WebPage`, a `BreadcrumbList` on inner pages) and the rule that
  every FAQ question and Offer price in JSON-LD is in the page's visible text.
- Generated output (`.next`, `.open-next`, `artifacts/`, frozen registry blobs) is
  never edited. Fix the generator, the template or the data file.

## Deploying

- Cloudflare Workers Builds deploys `main` outside GitHub Actions and reports back as
  the `Workers Builds: dream-wedding-builder` check. Never run a bare
  `wrangler deploy`.
- `.github/workflows/post-deploy-live-check.yml` waits for that check on the pushed
  commit and then runs `node scripts/validate/live-check.mjs` against the live hosts:
  the build can pass while the edge serves the wrong thing.
