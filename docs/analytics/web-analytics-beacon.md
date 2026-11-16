# Cloudflare Web Analytics beacon: why it names its endpoint

## What broke

From **8 October 2026** to **9 November 2026** no page load on any of the four wedding
hosts reached Cloudflare Web Analytics.

- `app/layout.tsx` rendered `data-cf-beacon='{"token":"…"}'` from commit `caf7133`
  (landed 2026-10-08), because the zone auto-install never reached this Worker's HTML.
- `beacon.min.js` chooses its endpoint as
  `send.to ?? (version === undefined ? "https://cloudflareinsights.com/cdn-cgi/rum" : "/cdn-cgi/rum")`.
  With only a token it posts **cross-origin**.
- A real Chromium load of `https://weddingchecklistpdf.com/` on 2026-11-09 logged:
  `Access to XMLHttpRequest at 'https://cloudflareinsights.com/cdn-cgi/rum' from origin
  'https://weddingchecklistpdf.com' has been blocked by CORS policy` → `net::ERR_FAILED`.
- Cloudflare's own data agreed: page loads for the four site tags stop at **2026-10-07**.
  The auto-install stops injecting once a page already carries a beacon, so the broken
  one was the only one.
- The site tokens were correct throughout (`site_token` from `rum/site_info/list`).

## The fix

`lib/web-analytics.ts` `beaconPayload()` renders `{"token":"…","send":{"to":"/cdn-cgi/rum"}}`.
The beacon reads `send.to` first, so the endpoint does not depend on the `version`
heuristic. Tested live on 2026-11-09: the same page patched in-browser posted to
`https://weddingchecklistpdf.com/cdn-cgi/rum` → **204**, and Cloudflare showed the load
(with its referrer host) within minutes. A fake `version` string also gave 204; it was not
chosen because it relies on an undocumented branch.

## Guards

- **Live:** `scripts/validate/live-check.mjs` assertion 9 (post-deploy, every host): exactly
  one beacon on the homepage, this host's token from `data/cf_web_analytics.json`, and
  `send.to` = `/cdn-cgi/rum`. Every build-time check was green for the 33 days this was
  broken, which is why the guard lives where the edge is read.
- **Unit:** `lib/__tests__/web-analytics.test.ts` pins the payload shape.

## What reads it

`scripts/brand_social/collect_metrics.mjs` (daily, `.github/workflows/brand-social-metrics.yml`)
writes `data/brand-social/metrics.json` for the Boss OS scorecard row `dw-brand-social`:

| field | source | not readable → |
|---|---|---|
| `posts_published_28d` | brands Buffer, `api.buffer.com/graphql`, sent posts on the `dreamweddingbuilder` Instagram and TikTok channels, counted on `sentAt` | absent; `unread.posts_published_28d` (today: `BUFFER_BRANDS_ACCESS_TOKEN` not set) |
| `social_visits_28d` | Web Analytics `rumPageloadEventsAdaptiveGroups` `sum.visits` for weddingchecklistpdf.com where `refererHost` is in `data/brand-social/social_referrers.json` | absent unless the live beacon can record **and** Cloudflare holds ≥1 page load in the window |
| `updatedAt` | every run | — (the scorecard refuses a file older than 9 days) |

The other three hosts are recorded under `by_host`, never added to the headline. Site tags
are resolved by zone name from `rum/site_info/list` on every run: the beacon's `site_token`
and the analytics `site_tag` are different values, and querying by the token reads an empty
metric. Because nothing was recorded from 8 Oct to 9 Nov, the first 28-day windows after the
fix cover fewer real days; `by_host.<host>.first_pageload_date` says from when.

Every absent metric also carries `unread_kind.<field>`: `missing_key` (a key the owner has not
given; listed under `missing_keys`), `no_traffic` (the host has no page loads yet) or `broken`
(anything else). The daily workflow runs `npm run brand-social:stop-check` after the file is
pushed: a `broken` metric is `NAMED STOP BRAND_SOCIAL_UNREADABLE` and a red run the same day,
so a fault cannot sit green the way the beacon did; the other two are notes. When a Buffer key
matches no channel, the reason lists the channels it does see.

A missing key is a note for 14 days only (`MISSING_KEY_GRACE_DAYS` in
`scripts/brand_social/lib.mjs`, two Mondays of the weekly scorecard). `missing_since.<KEY>` holds
the first day the file recorded it missing, carried forward by every run; from day 14 the stop
check treats it as `broken` and the daily run goes red, naming the days waited and the reply that
clears it (`SECRET <KEY>=<value>` to boss@sequoiataylor.com). Before this, a missing key was green
for ever and the scorecard row stayed blank with nothing asking for the key.
`BUFFER_BRANDS_ACCESS_TOKEN` was first recorded missing on 2026-11-09, so the run reds on
2026-11-23 if it has not arrived.

`npm run brand-social:prove` (after a deploy) runs the same reads without writing and fails
unless every host's live beacon can record.
