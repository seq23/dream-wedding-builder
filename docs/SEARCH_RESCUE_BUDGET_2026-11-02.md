# Budget site search rescue — November 2, 2026

The October 11 GSC receipt dates the visibility drop to October 1: the cost-per-guest landing supplied all 24 impressions in the prior week, then none in the following week. Clicks were zero in both weeks. The Monday audit reports 90 → 6 impressions over its comparison windows. Its exact prior window is not included. Ranking volatility is observed; the reason Google stopped showing the page is unproven.

Live curl checks on November 2 found 25 sitemap URLs, all 200 with index/follow and matching self-canonicals. Robots allows search and AI crawlers. The deliberate root redirect is healthy. A stale HTTP/www sitemap registration was removed October 11. The October 21 Next support expiry deployment incident happened after the original drop.

Ten live guide samples shared 24.7–78.8% of visible text with at least half the sample, measured by eight-word shingles including navigation and footer (median 67.8%). Repeated scaffold text and weak incremental substance are confirmed. Their effect on rankings is suspected. The November 2 coverage receipt reports nine indexed, fifteen crawled-not-indexed and one unknown URL among the 25. This confirms weak index selection. There is no evidence supporting seasonality or a Google penalty.

## Inventory and execution

Keep nine sitemap URLs: three guides (category field map, strengthened template, calculation workflow), the spreadsheet hub, the cost-per-guest and tradeoff landings, product, guide index and editorial policy. The template has historical impressions; the three landings and product have current or historical impressions. No measured query volume is claimed for the remaining editorial choices.

Sixteen overlapping guest-count, budget-amount and payment guides consolidate into the closest of the three budget hubs. `data/seo/budget_rescue.json` is the exact retirement map. Middleware serves a direct 301, including slash variants and requests on sibling hosts, preserving query attribution. Unknown paths retain their existing 404 behaviour. `hrefFrom` resolves retired links to final destinations.

Live registry and scoped frozen output are pruned together. The authority publisher refuses retired slugs and new budget variants; the shared question engine excludes budget discovery topics. The scaffold derivation uses known scaffold members so the two bespoke guides cannot outvote the remaining category guide into an invented modal shape. Other sites retain their publishing lanes.

The existing guide, hub, product and landing templates consume authored budget shape data. Definitions, visible FAQs, real business byline, dates and primary spreadsheet documentation are included. Existing planner seed hydration and checkout remain intact. No new validator was added. Existing inventory behaviour coverage now asserts the exact retained budget set while preserving the other hosts' minimum; no behaviour test was skipped or deleted.

Reference: read-only WPP-llm consolidation commits #71–73. This deployment is an OpenNext Worker, so redirects execute in middleware rather than relying on Pages `_redirects`.

## Verification and release

The PR records the final validation results. Merge and production deployment are outside this task. After deployment, check 301 destinations, retained sitemap URLs and three rendered editorial pages, then compare GSC daily impressions on the retained hubs. Recovery is not promised.

Local final repair batch (Node 22): `validate:all` passed (44 files, 899 tests plus structural checks); production build passed; `validate:registry` passed; strict post-build Amazon landing checks passed; cadence merge check passed. Earlier failures exposed stale inventories and were repaired at source. No test was skipped or deleted. Publication dates were then checked against each slug's introduction in git history.

The local sandbox disallows writes to the worktree's external git index and refs. The reviewed file changes are committed to a remote `work/*` branch through GitHub's Git Data API; local staging cannot be updated in this sandbox.
