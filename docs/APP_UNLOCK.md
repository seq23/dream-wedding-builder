# App purchase verification door

Task 8 server component. The phone delivery store, event ledger and screen wiring
are subsequent work; this route alone does not enable any purchase button.

`POST /api/app-unlock` accepts only an `Authorization: Bearer` header containing
the SDK's random `$RCAnonymousID:` followed by 32 lowercase hex characters. Treat
this ID as a private capability: never log it, send it in analytics, put it in a
URL or replace it with an email or predictable custom ID. Restore must use the
current anonymous SDK ID after the SDK restores the store receipt. No request
body, product selection or client entitlement list is trusted.

The Worker reads RevenueCat v1 Customer Info with its server secret. Only a
non-expiring supported entitlement backed by a matching production one-time
Apple/Google transaction qualifies. Sandbox, promotional, malformed, refunded and
unsupported records fail closed. Consumable new events deliberately do not grant
a global entitlement; they need the event-bound ledger in task 8.

Successful replies contain `active`, `expiresAt` and `downloads` (`id`, relative
`path`). Links last five minutes and authorize one allowlisted asset each, using
the existing download-token helper with a separate app signing domain. `GET` on
the link streams that asset from the private R2 binding. Links are bearer
capabilities; do not log or share them. Responses disable caching and indexing.
Unknown and refused customers receive the same status and body. Verification
has a ten-second timeout and a 512 KiB response cap; per-connection and global
rolling limits bound upstream calls. Failures return a retryable plain message.

## Configuration and stops

No configuration or product is created by code. The existing disabled purchase
provider stays disabled. Runtime bindings/secrets:

- `REVENUECAT_SECRET`: missing gives `NAMED STOP [REVENUECAT_SECRET_MISSING]`.
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

Coordinator must supply these private files (fictional bytes exercise delivery
in tests; no paid text is committed):

| Private source | Key in `dream-wedding-builder-products` | Entitlement |
| --- | --- | --- |
| `~/.boss-os/dream-wedding/printables-v1.zip` | `app/printables-v1.zip` | `printables` |
| `~/.boss-os/dream-wedding/day-of-kit-v1.zip` | `app/day-of-kit-v1.zip` | `day_of_kit` |

Reference contract: [RevenueCat Customer Info](https://www.revenuecat.com/docs/api-v1/customer-info-model)
and [customer lookup](https://www.revenuecat.com/docs/api-v1/customers).
Tests: `tests/unit/app-unlock.test.ts` use an in-memory database and fictional
transactions/bytes; they do not contact a store or RevenueCat.
