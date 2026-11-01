# Search Visibility Autonomy — Dream Wedding Builder

Status: ACTIVE, bounded additive lane.

## Purpose

Close the evidence loop without replacing the existing authority/publishing system:

`targets → own-site GSC evidence + agent-supplied sampled surfaces → diagnose → bounded repair → delayed retest → outcome ledger`

## Truth boundaries

- Google Search Console is authoritative only for this repo's own Google Search clicks, impressions, CTR, and average position.
- Agent/imported result observations are sampled surfaces. They are useful for competitor/context comparison but are not universal or guaranteed rank.
- No provider evidence means `UNCONFIGURED`/`INCONCLUSIVE`, never fabricated green status.
- Search intelligence does not change the authority publication cadence.

## Automatic fixes

Only hub meta-description defects are currently AUTO/AUTO_WATCH. The replacement text is derived from existing `direct_answer`, description, and H1 content. Route, canonical, title, positioning, page creation, and consolidation remain review-only. A 14-day anti-thrash floor applies.

## Agent observation bridge

A Repo Operator/LLM agent that performs live searches may write a strict observation JSON and run:

```bash
SEARCH_OBSERVATIONS_FILE=/absolute/path/observations.json npm run search:observe:import
npm run search:diagnose
npm run search:repair
npm run search:retest
npm run validate:search-intelligence
```

Each imported query needs timestamp, provider, result URLs, and an evidence URL or evidence note. This creates evidence accounting without pretending the repository itself has a free universal SERP API.

## Runtime gate

Search Intelligence remains a separate bounded lane, but it shares the same explicit launch switch as authority publication. Scheduled runs require `CONTENT_RELEASE_ENABLED=true` and `CONTENT_EMERGENCY_STOP!=true`. This prevents a write-capable scheduled lane from starting before the owner has deliberately enabled content automation.

## Scheduled zero/low-cost path

The scheduled GitHub workflow uses the already-supported GSC service-account secret when configured. If GSC is absent it preserves prior evidence and reports `UNCONFIGURED`; technical diagnosis/retest/validation still run.

## Shared search engine (/questions/), from 1 Nov 2026

Owner ruling 1 Nov 2026: the shared engine `seq23/search-loop` (pinned `@v1`) runs here daily
(`.github/workflows/search-loop.yml`, 06:11 CT). One config, `search-loop.config.json`, covers all
four domains: pages are static files `public/questions/<slug>.html`, canonical on
weddingchecklistpdf.com at `/questions/<slug>`, and may link to any of the four hosts. Every page
ends in the one action, the Wedding Checklist PDF checkout (`/products/checklist-pdf#look-inside`).
Pace starts at 10/day (+5/week while most are indexed, cap 30); no approval step; no health gate.

- **Linked, never orphaned:** the `/questions` hub (`app/questions/page.tsx`) lists every live page
  from the engine's ledger `data/search-loop/pages.json`, and is linked from every page's footer;
  the served `/sitemap.xml` and `artifacts/sitemaps/*.xml` carry the pages with their own dates
  (`lib/search-loop-pages.mjs` is the one reader); the engine submits IndexNow itself.
- **Own lane, own governor:** URLs under `/questions` are outside the cadence gate's freshness rule
  (`scripts/cadence/refresh_debt.cjs`) and outside this loop's coverage, repair and consolidation
  (`scripts/search_intelligence/lib.mjs` `sitemapUrlsFor`). Without that, the engine's first
  publish day would block the gate (`weekly_cap`, `published_into_refresh_debt`) and turn the
  daily CI red, and its fresh dates would dilute the guide library's stale share so the guide
  publisher resumed before the refresh lane had paid the debt down. The engine checks its own pages
  at 2/4/8 weeks and merges at 90 days with no impressions (a 301 in `public/_redirects`); the
  refresh lane keeps refreshing the oldest guides. The two never edit each other's pages.
- **The 11 Oct "frozen until Search Console has a number" rule is off** for this site
  (`data/search_intelligence/config.json` `publishing_freeze.enabled: false`).
- **Throttle all sites at once:** `gh variable set SEARCH_LOOP_MODE --body slow -R seq23/search-loop`
  (`normal | slow | off`). Weekly report: the `search-loop-week` artifact on each run.
