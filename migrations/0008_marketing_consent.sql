-- The planner no longer asks for an email before the plan, and the marketing tick is
-- optional (owner, 10 Nov 2026). builder_signups gains marketing_consent:
-- 1 = ticked, 0 = email given without it (no marketing email, ever), NULL = a row
-- from before this change, when the tick was compulsory, so NULL counts as consented.
--
-- SQLite has no ADD COLUMN IF NOT EXISTS, and every migration here must be safe to
-- apply twice, so the column is NOT added in this file. On a database that already
-- has the table, lib/builder-signup.ts (ensureSignupTable) adds it with one guarded
-- ALTER TABLE ... ADD COLUMN the first time a sign-up is stored or the nurture job
-- runs. This file covers a fresh database. Additive only; no existing row changes.
CREATE TABLE IF NOT EXISTS builder_signups (
  email TEXT PRIMARY KEY,
  consent_text TEXT NOT NULL,
  source TEXT,
  host TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unsubscribed_at TEXT,
  marketing_consent INTEGER
);
CREATE TABLE IF NOT EXISTS schema_version (
  migration TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO schema_version (migration) VALUES ('0008_marketing_consent');
