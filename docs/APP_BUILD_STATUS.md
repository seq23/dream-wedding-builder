# Dream Wedding app — 11 Nov 2026

Review #143 is already fixed by #144; the expired-window deadline regression test remains.

Task 8a: Payments tab, dated payment-marker rows, local amounts/methods, personal
payments, totals, urgency groups, paid date and undo. Preview uses two fictional
payment tasks and separate local storage. Free view shows only two allowed teasers.
Payment data makes no network calls. Behaviour test covers gating, totals, date
changes, paid/undo and storage isolation.

NAMED STOP [REVENUECAT_SECRET_MISSING]: purchase delivery is unavailable; real paid
rows stay closed until task 8 supplies a verified event-bound delivered list.
Task 8 remains draft #150; no purchase/unlock path is claimed by this change.
Tasks 4–7 remain in open PRs #139/#147/#149/#148.
Next: 8b (wedding-week screen requires pattern notes), then 8c.
NAMED STOP [WAITS_FOR_LAUNCH_PLAN]: tasks 10 and 12.
