# Environment Variables

## APPS_SCRIPT_TREND_ENDPOINT
Optional Apps Script Web App URL for bride-submitted trend intake. If absent, `/api/submit-trend` returns a local contract success without forwarding. This is not a fake live integration claim; it is contract-ready behavior.

## APPS_SCRIPT_TREND_SECRET
Optional shared secret sent as `x-dwb-secret` to Apps Script.

## CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID (brand social metrics)
GitHub Actions secrets, already used by the Pinterest drip and the weekly summary. `scripts/brand_social/collect_metrics.mjs` (workflow `brand-social-metrics.yml`) uses them read-only to list the account's Web Analytics sites (`/accounts/{id}/rum/site_info/list`) and query `rumPageloadEventsAdaptiveGroups` through the GraphQL API. The token needs Account Analytics read. Absent or refused: NAMED STOP, the run is red and the last good `data/brand-social/metrics.json` stays.

## BUFFER_BRANDS_ACCESS_TOKEN
GitHub Actions secret (vault name the same): a Buffer access token for the brands Buffer, the one holding Dream Wedding's Instagram and TikTok (not the Porch & Party Buffer, whose `BUFFER_ACCESS_TOKEN` cannot see those channels). Read-only use: organizations, channels and sent posts through `api.buffer.com/graphql`. Absent: `posts_published_28d` is left out of the metrics file with `unread.posts_published_28d` naming this key; the visits half still runs.
