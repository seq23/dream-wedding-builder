# Schedule

Every scheduled GitHub Actions job in this repo. Times are Central (America/Chicago): each
`schedule:` entry carries `timezone: America/Chicago`, which GitHub Actions honours, so the clock
change in March and November no longer moves a job. Rebalanced 1 Nov 2026 (owner-approved weekly
schedule); see the notes below for what moved.

| Job | Workflow | When | Cron |
|---|---|---|---|
| Authority Preflight Validation | `authority-preflight-validation.yml` | every day 04:17 CT | `17 4 * * *` |
| CI - Build and Validate | `ci.yml` | every day 07:40 CT | `40 7 * * *` |
| Entity Backlink Watch | `entity-backlink-watch.yml` | Fri 07:00 CT | `0 7 * * 5` |
| Full Safe Autonomy | `full-safe-autonomy.yml` | every day 05:17 CT | `17 5 * * *` |
| Pinterest drip (weekly refill + metrics) | `pinterest-drip.yml` | Sat 06:40 CT | `40 6 * * 6` |
| Search Intelligence - Observe Diagnose Repair Retest | `search-intelligence.yml` | every day 06:41 CT | `41 6 * * *` |
| Bounded Self-Healing | `self-heal.yml` | Wed 11:18 CT | `18 11 * * 3` |

## Weekly windows

- **Saturday 04:00–08:00 CT is the weekly-upkeep window for every Spry Labs side business**
  (owner ruling, 1 Nov 2026): weekly maintenance, refresh and metrics jobs run there, staggered
  at least 15 minutes apart, never two in the same slot. Publishing, link checks and
  self-healing are not upkeep and keep their own days.

## Moved on 1 Nov 2026
- Pinterest drip (weekly refill + metrics): Monday → Saturday 06:40 CT (upkeep window).
- Entity Backlink Watch: Monday → Friday 07:00 CT (backlink watches are spread Thursday/Friday).
- The Worker's hourly delivery retry (`wrangler.jsonc`, `0 * * * *` UTC) is unchanged.
