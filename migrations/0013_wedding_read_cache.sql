-- "I don't know yet" answers kept 7 days by her taps (lib/wedding-read.ts readCacheKey):
-- taps and her town only, never her own words or an image; test traffic never writes here.
CREATE TABLE IF NOT EXISTS wedding_read_cache (
  cache_key TEXT PRIMARY KEY,
  read TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS schema_version (
  migration TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO schema_version (migration) VALUES ('0013_wedding_read_cache');
