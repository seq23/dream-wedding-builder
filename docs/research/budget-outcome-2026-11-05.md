# Budget outcome investigation — 5 November 2026 UTC

Scoped brief: `so-weddingbudgetspreadsheet.com-outcome` (o1). Baseline: `4173b39`. Repository mapping: grid manifest. No overlapping open PR or salvaged PR was found before investigation.

## Confirmed evidence

Read-only gsc-bot requests in this run confirm property visibility and the exact comparison: 73 impressions / zero clicks for 8 September–5 October, versus six / zero for 6 October–2 November. Page rows are nonadditive and are not substituted for property totals. The cost-per-guest page supplied 71 prior-window impressions and none in the current window. Daily history places its last showing on 30 September, before the 2 November consolidation.

A fresh production crawl fetched all nine sitemap pages and checked 46 targets with no findings. Cache-busted browser-UA GETs confirm robots.txt and sitemap.xml answer 200. The cost-per-guest and budget-template pages answer 200, index/follow, with self-canonicals. The retired estimated-versus-actual guide answers a direct 301 to the budget spreadsheet hub, whose final response is 200 with its own canonical. The 25-to-nine sitemap reduction is intentional PR #70 consolidation, not a disappearing sitemap.

Fresh URL Inspection: cost-per-guest is Submitted and indexed, indexing allowed, fetch successful, matching Google/user canonical, last crawled 3 November. Budget-template is likewise indexed. Estimated-versus-actual is Crawled - currently not indexed with a 31 October crawl: that predates its retirement and is not evidence the current 301 is broken. The sitemap registration answers 200 with zero errors/warnings; its last download is 2 November and it still reports 25 submitted. Its indexed=0 summary is not a live count of indexed pages.

## Changes around the decline

Reviewed git history for 24 September–4 October, including middleware, robots, sitemap, ownership and SEO changes. PR #18 on 25 September added HTTP-to-HTTPS normalization and final-owner links; PR #19 corrected title length. The page continued receiving impressions through 30 September after those changes. No robots, sitemap-route or ownership change appears in that interval. This timing does not prove a ranking cause, but supplies no reproduced technical regression to reverse. Later repairs: PR #32 removed a stale HTTP/www sitemap registration (11 October); PR #42 restored guest-count content (26 October); PR #70 consolidated repeated budget guides and improved their templates (2 November). The original decline predates all three. November quality and consolidation work is already live.

## Decision and limits

No new site change is justified by this evidence. Ranking recovery is unproven; do not claim that a penalty, update, seasonality or any particular content change caused the decline. Preserve the existing redirects and the retained indexed page rather than resurrecting overlapping guides or rewriting content speculatively. Danielle will compare retained-hub impressions and index snapshots on the next weekly run.

The full Search Console Pages history and Manual actions UI were not read: the in-app browser is unavailable in this execution. The read-only API provides URL Inspection snapshots, not those UI reports. This limits the diagnosis; it is not evidence of a manual action or absent property and does not justify a site mutation. Machine-readable receipts are adjacent, contain no credentials, and distinguish current live responses from Google's last crawl.

Disposition: none (no newly reproduced defect). This PR preserves the investigation; it is not a site fix or a claim of search recovery.

Validation: `npm run validate:all` passed (typecheck, 46 unit test files / 639 tests, structural validators). No new test was added for evidence-only documentation.
