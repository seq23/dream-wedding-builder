# App purchase verification door

The server half of every app purchase. The phone opens the store
(`apps/mobile/src/billing/current.ts`: RevenueCat, only in a store build with
`EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` from the EAS production environment; the preview
and web stay closed), then calls this door; nothing unlocks until it answers.

`POST /api/app-unlock` accepts only an `Authorization: Bearer` header containing
the SDK's random `$RCAnonymousID:` followed by 32 lowercase hex characters. Treat
this ID as a private capability: never log it, send it in analytics, put it in a
URL or replace it with an email or predictable custom ID. Restore must use the
current anonymous SDK ID after the SDK restores the store receipt. No request
body, product selection or client entitlement list is trusted.

The Worker reads RevenueCat v1 Customer Info with its server secret. Only a
non-expiring supported entitlement backed by a matching production one-time
Apple/Google transaction qualifies. Sandbox, promotional, malformed, refunded and
unsupported records fail closed.

**New events (`dw_new_event`, consumable).** A consumable never grants a global
entitlement. For a buyer whose first full plan is confirmed, the reply also carries
`newEvents`: one opaque token per verified `dw_new_event` store transaction (a hash of
the store and transaction id; production only unless the sandbox switch is on; refunded,
future-dated and malformed transactions are left out). RevenueCat's reply is the count,
so the door stores nothing and no table is needed. The same transaction always gives the
same token: asking again, Restore, or a replayed transaction cannot add an event. The
phone binds each token to exactly one event in its purchase record
(`apps/mobile/src/billing/events.ts`), which "Delete my plan" keeps, so a used purchase
never pays for another event. Restore records every confirmed token; a paid event not
yet started on that phone is started from "Start a new event" at no charge. A consumable
without a confirmed first full plan answers exactly like an unknown buyer.
RevenueCat offering for this screen: `new_event`, holding `dw_new_event` only.

Successful replies contain `active`, `expiresAt`, `newEvents` and `downloads` (`id`, relative
`path`). Links last five minutes and authorize one allowlisted asset each, using
the existing download-token helper with a separate app signing domain. `GET` on
the link streams that asset from the private R2 binding. Links are bearer
capabilities; do not log or share them. Responses disable caching and indexing.
Unknown and refused customers receive the same status and body. Verification
has a ten-second timeout and a 512 KiB response cap; per-connection and global
rolling limits bound upstream calls. Failures return a retryable plain message.

## Google Play review code (`lib/review-unlock.ts`)

Play's reviewer cannot buy, and the app has no accounts, so on Android only the full-plan screen shows a small grey
"Have a review code?" link while the wedding is unpaid and `GET /api/review` answers 200. The reviewer types the
10-digit code from Play Console's private sign-in details; `POST /api/review/unlock { code, app_user_id }` checks it and
asks RevenueCat (v2 `grant_entitlement`) for `full_plan`, `printables` and `day_of_kit` until
`min(now + 7 days, REVIEW_UNTIL)`, all three or none. The phone then verifies exactly like Restore (checkout `review`:
`invalidateCustomerInfoCache` + `getCustomerInfo`, no receipt restore) and this door delivers. Design and pass/fail list:
`~/Work/google-play-2026-11-21/REVIEW-UNLOCK-DESIGN.md` (sections 3, 4, 7); KeepMyProof and Peace Be Still run the same contract.

- **This door** adds review entitlements only while ALL hold: the window is open, a live `review_grant` row exists for this
  ID and the current `REVIEW_CODE_VERSION`, and RevenueCat `active_entitlements` still shows a dated (granted) entitlement.
  A revoke in RevenueCat, the expiry, a closed window or a new code version ends delivery; a sandbox or Test Store
  entitlement with no row never counts; the refusal is the same 403 as "no purchase". Real purchases are read exactly as
  before and are never changed or hidden. A grant also carries ONE new event (`newEvents`), a fixed HMAC of the code
  version and ID, so it starts one event only. Review grants are never counted as sales.
- **Limits** (before the code is compared, `rate_events` keyed by an HMAC of the IP): 5 a minute, 20 a day per IP,
  1,000 a day in all. A made-up ID (RevenueCat 404) takes no slot. At most `REVIEW_MAX_DEVICES` (10) phones per code
  version and 2 new phones per IP a day; the same phone again takes no slot and gets a fresh grant. The 11th phone gets
  `USED_UP` and `NAMED STOP [REVIEW_DEVICE_CAP]`, which files an Open Loops row (rotate the code).
- **Outage**: any RevenueCat failure revokes the granted entitlements (`revoke_granted_entitlement`, never a purchase),
  frees the slot and answers 503 `TRY_AGAIN`; a 403 on grant logs `REVIEW_RC_KEY_READONLY` (the key needs
  `customer_information:customers:read_write`).
- **Storage**: `migrations/0015_review_grant.sql` (HMAC'd ID, code version, timestamps); the hourly cron deletes rows
  7 days past expiry and review try counters older than a day. Applied to the live D1 on 22 Nov 2026 with
  `npx wrangler d1 execute dream-wedding-builder --remote --file=migrations/0015_review_grant.sql` (additive, safe to re-run).
- **Secrets on the Worker** (all secrets, so they survive deploys): `REVIEW_CODE` (vault `DW_PLAY_REVIEW_CODE`),
  `REVIEW_HASH_SECRET` (vault `DW_REVIEW_HASH_SECRET`), `REVIEW_CODE_VERSION` (`v1`; a new code gets a new version),
  `REVIEW_UNTIL` (ISO date, kept open while the app is live on Play, renewed yearly), `BOSS_OPEN_LOOPS_TOKEN`. Any one
  missing or malformed, or `REVIEW_UNTIL` past: every review route answers 404 and calls no one.
- **Rotate** only on `REVIEW_DEVICE_CAP` or a suspected leak: new `DW_PLAY_REVIEW_CODE` in the vault, new `REVIEW_CODE` and
  `REVIEW_CODE_VERSION` on the Worker, then the password in Play Console's sign-in details changes.
- Tests: `tests/unit/review-unlock.test.ts` (server and door) and `apps/mobile/test/reviewCode.unit.ts` (the phone).

## Configuration and stops

No configuration or product is created by code. Set on the live Worker on 14 Nov 2026
(secrets, so they survive deploys): `REVENUECAT_SECRET`, `APP_PURCHASES_ENABLED=true`,
`APP_SANDBOX_PURCHASES=true` (TestFlight and App Review buy in the sandbox). Runtime bindings/secrets:

- `REVENUECAT_SECRET`: the Dream Wedding project's RevenueCat **v2** secret key (vault `REVENUECAT_DW_V2_SECRET_KEY`; needs customer and purchase read plus product read). The door reads `GET /v2/projects/{project}/customers/{id}/purchases` and `/products`. Missing gives `NAMED STOP [REVENUECAT_SECRET_MISSING]`; a key RevenueCat refuses gives `NAMED STOP [REVENUECAT_KEY_REJECTED]`.
- `APP_PURCHASES_ENABLED=true`: absent gives `NAMED STOP [DW_STORE_NOT_SET_UP]`.
  Leave absent until store setup and end-to-end purchase review are complete.
- `APP_SANDBOX_PURCHASES=true`: accepts store sandbox transactions as well. Apple and
  Google reviewers buy in the sandbox, so set it for the review period (and for her own
  test purchase); otherwise their purchase is refused and the app fails review. Sandbox
  purchases are never counted on the scorecard. Leave absent at all other times.
- `DOWNLOAD_SIGNING_SECRET`, `DB`, `PRODUCT_RELEASES`: missing gives
  `NAMED STOP [APP_DELIVERY_NOT_CONFIGURED]`.
- Missing private objects give `NAMED STOP [APP_PAID_ASSET_MISSING]`, never an
  empty successful download.

Existing objects: `plans/checklist-full-plan-v1.json` and
`packs/traditions/<id>-v1.json` in `dream-wedding-builder-products`.
The full-plan entitlement authorizes those eight JSON assets.

These private files were uploaded on 13 Nov 2026 and read back byte for byte
(contents: `docs/APP_PLAN.md`, "Paid content is never in the public repo"; fictional
bytes exercise delivery in tests; no paid text is committed):

| Private source | Key in `dream-wedding-builder-products` | Entitlement |
| --- | --- | --- |
| `~/.boss-os/dream-wedding/printables-v1.zip` | `app/printables-v1.zip` | `printables` |
| `~/.boss-os/dream-wedding/day-of-kit-v1.zip` | `app/day-of-kit-v1.zip` | `day_of_kit` |

Reference contract: [RevenueCat Customer Info](https://www.revenuecat.com/docs/api-v1/customer-info-model)
and [customer lookup](https://www.revenuecat.com/docs/api-v1/customers).
Tests: `tests/unit/app-unlock.test.ts` use an in-memory database and fictional
transactions/bytes; they do not contact a store or RevenueCat.
