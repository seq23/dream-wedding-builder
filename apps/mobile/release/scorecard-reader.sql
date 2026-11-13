-- Boss OS d1 reader, params.db = dream-wedding-builder, params.days = 30.
-- :since_ms is replaced by the existing Boss OS reader, not sent to D1.
-- First reaches and confirmed transactions in the same rolling 30-day window.
-- Missing migration fails; zero reach is unmeasured (NULL), never 0%.
SELECT CASE WHEN (SELECT COUNT(*) FROM app_plan_reach WHERE reached_at >= :since_ms) = 0
  THEN NULL
  ELSE 100.0 * (SELECT COUNT(*) FROM app_confirmed_unlocks WHERE purchased_at >= :since_ms)
    / (SELECT COUNT(*) FROM app_plan_reach WHERE reached_at >= :since_ms)
  END AS n;
