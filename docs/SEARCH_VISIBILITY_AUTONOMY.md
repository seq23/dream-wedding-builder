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
