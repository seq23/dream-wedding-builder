# App sharing server (task 7, unfinished)

The route is off unless APP_SHARING_ENABLED=true. Leave it unset in production.
Before enabling: apply migrations/0009_plan_shares.sql through the governed deploy,
finish the phone protocol and entitlement gate, run the target-day load test against
preview and verify two real clients, revoke, restore and conflict retry end to end.

POST /api/plan-share accepts {ciphertext: base64} and returns a 256-bit random id
and revision 1. GET ?id= returns ciphertext and revision. PUT ?id= accepts
{ciphertext, revision}; stale revisions return 409. The phone must fetch, decrypt,
merge ticks by latest timestamp, re-encrypt with a fresh nonce and retry. DELETE
?id= revokes the transport capability. All replies are no-store. Shares expire
90 days after creation; updates do not extend that retention period.

The id is a bearer transport capability. Only send it to the canonical HTTPS host.
The encryption key must be independently random and kept in the link fragment;
never put it in an API request, query, logs or analytics. Authenticated encryption
and the unknown/wrong-key common client error belong to the phone implementation.
The server cannot validate that base64 is encrypted: it treats it as opaque bytes.
Do not put plain JSON in the payload or trust any client claim of paid access.

Sharing cannot grant full_plan until the independent server purchase verification
exists. Deleting a share cannot erase content already downloaded to another phone;
the joined phone must drop its event entitlement and paid content on revocation.

Request size includes JSON overhead and is limited to 256 KB, even with chunked
transfer. Rate limits: 120 requests/minute/IP, 10,000 requests/day globally and
4,000 mutating requests/day globally (UTC days). The write budget includes 3,000
creates plus 1,000 updates; the request budget is a conservative stop, not proof
that a day of one-minute polling fits the free allowance. Task 7 stays held until
the load check demonstrates the full client protocol within the free allowance.
