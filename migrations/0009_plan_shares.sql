-- Opaque app ciphertext only. No names, keys or paid entitlement claims.
CREATE TABLE IF NOT EXISTS app_plan_shares (
  id TEXT PRIMARY KEY,
  ciphertext TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS app_plan_shares_expiry ON app_plan_shares(expires_at);
CREATE TABLE IF NOT EXISTS app_share_capacity (
  day TEXT PRIMARY KEY,
  requests INTEGER NOT NULL DEFAULT 0,
  writes INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS schema_version (
  migration TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO schema_version (migration) VALUES ('0009_plan_shares');
