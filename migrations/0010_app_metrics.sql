-- Opaque hashes only. First reach and store transaction are each counted once,
-- including after Restore or deleting/recreating a plan. No customer content.
CREATE TABLE IF NOT EXISTS app_plan_reach (
  installation_hash TEXT PRIMARY KEY,
  reached_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS app_plan_reach_at ON app_plan_reach (reached_at);
CREATE TABLE IF NOT EXISTS app_confirmed_unlocks (
  transaction_hash TEXT PRIMARY KEY,
  purchased_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS app_confirmed_unlocks_at ON app_confirmed_unlocks (purchased_at);
