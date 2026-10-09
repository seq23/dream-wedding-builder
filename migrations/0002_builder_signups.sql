-- Emails collected by the free planning builder's email gate (app/api/builder-signup).
-- The route also runs this CREATE TABLE IF NOT EXISTS itself, so a deploy that
-- precedes this migration still stores signups instead of failing them.
CREATE TABLE IF NOT EXISTS builder_signups (
  email TEXT PRIMARY KEY,
  consent_text TEXT NOT NULL,
  source TEXT,
  host TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unsubscribed_at TEXT
);
