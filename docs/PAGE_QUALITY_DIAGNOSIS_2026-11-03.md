# Dream Wedding Builder diagnosis — 2026-11-03
Method: live HTTPS sitemaps; first 10 sorted guide URLs per requested host; curl follows redirects; visible-text eight-word shingles including navigation/footer. Shared % = median coverage of each sample by the other samples.
weddingchecklistpdf.com: 68 sitemap URLs; n=10; shared-text median 74.2% (range 25.1–76.0%); sampled <300 visible words: 0.
weddingseatingchartmaker.com: 25 sitemap URLs; n=10; shared-text median 68.5% (range 64.9–69.5%); sampled <300 visible words: 0.
weddingtimelinetemplate.com: 27 sitemap URLs; n=10; shared-text median 71.0% (range 65.7–72.2%); sampled <300 visible words: 0.
weddingbudgetspreadsheet.com: 9 sitemap URLs; n=9; shared-text median 16.1% (range 14.3–38.9%); sampled <300 visible words: 0.
Budget has only nine live URLs after PR #70; all nine sampled, rather than inventing a tenth.
Clusters: checklist month-count variants; seating guest-count/table-shape/meal/handoff variants; timeline venue/daypart/photo/vendor/reception variants. Most use the same scaffold with three authored sentences.
No sampled page is literally <300 visible words; navigation, repeated steps, mistakes and control-check text inflate apparent length. Consolidation is justified by overlapping intent, not a claim that these pages have zero words.
Demand: data/search_intelligence/gsc_truth.json, gsc_page_history.json, observations.json, index_coverage.json and consolidation_candidates.json. Current 28-day window 2026-10-04–31: checklist 82 impressions/0 clicks; seating 7/0; timeline 5/1; budget 6/0 (property totals; page rows are nonadditive).
Preserve measured checklist elopement/courthouse/destination guides and bespoke decision guides. Consolidate numeric and logistical variants into substantive owners; low exposure is observed, Google’s cause is unproven.
Five same-path live checks × four domains: /guides/12-month-wedding-checklist → checklist; /guides/wedding-day-timeline → timeline; /guides/wedding-budget-template → budget; /guides/wedding-guest-list-headcount-control → seating; /questions → checklist. All final URLs 200 with owner canonicals; non-owner requests redirect. Thus sampled cross-host guide duplication is already prevented at this baseline.
Change: guest-list general guide retires directly to the guest-list hub, rehomed to checklist. General six-month planning also rehomes to checklist. Tool-specific guides stay on their tool domains. No live post-PR changes claimed: PR is deliberately unmerged.
Exact kept/redirect ledgers: data/seo/page_rescue.json plus unchanged budget_rescue.json. Protected business routes remain intact.
Full live crawl: all 129 sitemap URLs fetched, zero errors. Main-content pages under 300 words: checklist /disclaimer 160, /products/operations-suite 161, /questions 216, /refund-policy 88, /terms 102; budget /guides 183. These are protected legal, service or menu pages and are retained. No generated guide was under 300 main-content words.
