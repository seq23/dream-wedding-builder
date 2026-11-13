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
