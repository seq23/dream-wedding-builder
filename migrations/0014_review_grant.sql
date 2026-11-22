-- Google Play review code (lib/review-unlock.ts). Additive only; no existing table is altered.
-- One row per phone that redeemed a code version (window_id = REVIEW_CODE_VERSION): it counts the device cap and proves
-- a RevenueCat grant was ours. id_hash is an HMAC (REVIEW_HASH_SECRET) of the anonymous purchase ID: never the raw ID.
-- expires_at 0 = a slot reserved while the grants are made (opens no door). Purged 7 days after expiry (worker.ts cron).
-- Try counters use the existing rate_events table, keyed by an HMAC of the IP.
CREATE TABLE IF NOT EXISTS review_grant (
  window_id TEXT NOT NULL,
  id_hash TEXT NOT NULL,
  granted_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (window_id, id_hash)
);
CREATE TABLE IF NOT EXISTS schema_version (
  migration TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO schema_version (migration) VALUES ('0014_review_grant');
