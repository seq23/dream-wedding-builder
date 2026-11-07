# Schedule

Every scheduled GitHub Actions job in this repo. Times are Central (America/Chicago): each
`schedule:` entry carries `timezone: America/Chicago`, which GitHub Actions honours, so the clock
change in March and November no longer moves a job. Rebalanced 1 Nov 2026 (owner-approved weekly
schedule); see the notes below for what moved.

| Job | Workflow | When | Cron |
|---|---|---|---|
| Authority Preflight Validation | `authority-preflight-validation.yml` | every day 04:17 CT | `17 4 * * *` |
| CI - Build and Validate | `ci.yml` | every day 07:40 CT | `40 7 * * *` |
| Entity Backlink Watch | `entity-backlink-watch.yml` | Thu 07:40 CT | `40 7 * * 4` |
| Full Safe Autonomy | `full-safe-autonomy.yml` | every day 05:17 CT | `17 5 * * *` |
| Pinterest drip (daily questions + refill; metrics on Saturdays) | `pinterest-drip.yml` | daily 07:20 CT | `20 7 * * *` |
| Search Loop (shared engine, /questions/ pages) | `search-loop.yml` | every day 06:11 CT | `11 6 * * *` |
| Search Intelligence - Observe Diagnose Repair Retest | `search-intelligence.yml` | every day 06:41 CT | `41 6 * * *` |
| Bounded Self-Healing | `self-heal.yml` | Wed 10:10 CT | `10 10 * * 3` |
| Spry Labs weekly summary | `spry-weekly-summary.yml` | Wed 07:53 CT | `53 7 * * 3` |

## Weekly windows

- **Saturday 04:00–08:00 CT is the weekly-upkeep window for every Spry Labs side business**
  (owner ruling, 1 Nov 2026): weekly maintenance, refresh and metrics jobs run there, staggered
  at least 15 minutes apart, never two in the same slot. Publishing, link checks and
  self-healing are not upkeep and keep their own days.

## Moved on 1 Nov 2026
- Pinterest drip (weekly refill + metrics): Monday → Saturday 06:40 CT (upkeep window); since 1 Nov 2026 it runs daily at 07:20 CT, after the search loop. Pins of a generation she has not approved wait in `queue.json` `pending`; after her yes one command releases them: `gh workflow run pinterest-drip.yml -R seq23/dream-wedding-builder -f approve=<generation>`.
- Entity Backlink Watch: Monday → Thursday 07:40 CT (four backlink watches on Thursday, 20 minutes apart).
- The Worker's hourly delivery retry (`wrangler.jsonc`, `0 * * * *` UTC) is unchanged.
- Bounded Self-Healing joins the Wednesday 10:00–10:30 CT self-healing sweep (p-n-p 10:00, Dream Wedding 10:10, backlink network 10:20, WPP 10:30).
- Spry Labs weekly summary joined Wednesday 07:53 CT (after the other side businesses, 07:03–07:48): it hands
  Dream Wedding's week to the 08:15 "Spry Labs weekly" email from Boss OS. No email from this repo.
- Search Loop joined every day 06:11 CT (1 Nov 2026): the shared engine seq23/search-loop finds, publishes and checks
  /questions/ pages on weddingchecklistpdf.com, between Full Safe Autonomy (05:17) and Search Intelligence (06:41).
