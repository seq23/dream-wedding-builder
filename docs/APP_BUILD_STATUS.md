# Dream Wedding app — 11 Nov 2026

Review #143 is already fixed in scaffold #144: personal deadlines use the original
window end; tests/unit/full-plan-card.test.ts covers expiry. No duplicate fix.

Task 8 is partial (draft PR): disabled purchase screen, native RevenueCat adapter,
and tested event-policy reducers. No SDK is configured at runtime; no sale,
restore, download, store account or product was created. No paid content added.

Unfinished: server-verified /api/app-unlock and signed delivery, durable event-bound
purchase ledger/restore (including consumables), integration with date/name edits,
new-event flow, printables delivery, and verified shared-event entitlement/revocation.
The reducers alone do not implement or authorize those flows. Task 7 remains draft
#148; task 8 cannot claim joined-phone or restore acceptance until they are wired.
NAMED STOP [DW_STORE_NOT_SET_UP]: store accounts/products and RevenueCat are absent.
NAMED STOP [REVENUECAT_SECRET_MISSING]: keep purchase/download activation closed.

Tasks 4–7 remain in open PRs #139/#147/#149/#148. Next: finish task 8, then 8a.
NAMED STOP [WAITS_FOR_LAUNCH_PLAN]: tasks 10 and 12.
