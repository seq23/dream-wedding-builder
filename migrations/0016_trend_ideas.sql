-- The standout-idea form's store (lib/trend-ideas.ts). Additive only; no existing table is altered.
-- One row per idea a visitor sends from the homepage form, read only on the owner-signed-in /admin page.
-- ip_hash is a salted SHA-256 of the caller's address: the address itself is never stored.
-- is_test = 1 marks a TEST submission (set by the owner afterwards, never from the request).
-- The code also runs this CREATE ... IF NOT EXISTS itself, so a deploy that precedes this
-- migration still keeps ideas instead of failing.
CREATE TABLE IF NOT EXISTS trend_ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submitted_at TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  idea_name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  budget_feel TEXT NOT NULL DEFAULT '',
  why_cool TEXT NOT NULL DEFAULT '',
  price_this_out INTEGER NOT NULL DEFAULT 0,
  is_test INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS schema_version (
  migration TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO schema_version (migration) VALUES ('0016_trend_ideas');
