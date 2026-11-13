-- The free journey's result that counts: a bride who began at step 1 reached her dated
-- plan (lib/journey-reach.ts). One row per visitor per day; opaque hash only.
CREATE TABLE IF NOT EXISTS journey_plan_reach (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  via TEXT NOT NULL,
  is_test INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (ip_hash, day)
);
CREATE INDEX IF NOT EXISTS journey_plan_reach_created ON journey_plan_reach (created_at);
CREATE TABLE IF NOT EXISTS schema_version (
  migration TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO schema_version (migration) VALUES ('0012_journey_plan_reach');
