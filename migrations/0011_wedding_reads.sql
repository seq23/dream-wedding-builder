-- The free journey's step 2 (lib/wedding-read.ts): three answers per visitor per day.
-- Opaque hashes only: no words, no photos, no email. The Worker also creates this
-- table on first use (CREATE TABLE IF NOT EXISTS), as it does ai_drafts.
CREATE TABLE IF NOT EXISTS wedding_reads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  outcome TEXT NOT NULL,
  model TEXT,
  photos INTEGER NOT NULL DEFAULT 0,
  is_test INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS wedding_reads_ip_day ON wedding_reads (ip_hash, day);
CREATE INDEX IF NOT EXISTS wedding_reads_day ON wedding_reads (day);
CREATE TABLE IF NOT EXISTS schema_version (
  migration TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO schema_version (migration) VALUES ('0011_wedding_reads');
