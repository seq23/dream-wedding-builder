# Repo Identity

Repo slug: dream-wedding-builder  
Product: Dream Wedding Builder  
Final output: Dream Wedding Starter Pack  
Default branch: main  
Public domains: weddingchecklistpdf.com, weddingbudgetspreadsheet.com, weddingseatingchartmaker.com, weddingtimelinetemplate.com  
Deployment target: Cloudflare Workers (OpenNext; `wrangler.jsonc` is authoritative)  
Framework: Next.js + TypeScript + Tailwind  
Complexity: Level 3 interactive no-auth app with deep E2E override  
Artifact pattern: dream-wedding-builder-main_BASELINE_MM-DD-YY_<sha>.zip

## Domains this repository serves

`data/seo/route_ownership.json` is authoritative; this list is generated from it and pinned by
`npm run validate:identity-domains`. One Worker build serves every host below.

Canonical hosts:

- weddingchecklistpdf.com — parent host; `/` renders the homepage
- weddingbudgetspreadsheet.com — `/` redirects 308 to `/wedding-budget-spreadsheet`
- weddingtimelinetemplate.com — `/` redirects 308 to `/wedding-timeline-template`
- weddingseatingchartmaker.com — `/` redirects 308 to `/wedding-seating-chart`

Alias host (answers, never publishes):

- weddingpdfchecklist.com — 301s every path to its canonical host; printed inside five published
  Kindle EPUBs, so it must resolve, but it must never render a second indexable copy.

**A `/` that redirects is deliberate, not a canonical defect.** Three of these hosts sell one product
each, so their `/` is a permanent redirect to that product's hub page and the hub page carries the
self-referencing canonical (`middleware.ts`, `root_action: "redirect"`). An auditor that follows the
redirect and then compares the canonical against the pre-redirect `/` will report a hijacked
canonical that does not exist; that is what Boss OS's Search Readiness a2 check did on 26 Oct 2026
before boss-os#150 taught it to judge the canonical against the URL the HTML came from.
