-- The Builder's AI draft step (lib/ai-draft.ts): one row per attempt, so the free
-- allowance (1 per email, 3 per IP a day, 50 a day overall) is counted on the
-- server. Email and IP are stored only as salted SHA-256 hashes. The route also
-- runs this CREATE TABLE IF NOT EXISTS itself, so a deploy that precedes this
-- migration still counts.
CREATE TABLE IF NOT EXISTS ai_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  outcome TEXT NOT NULL,
  model TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ai_drafts_email ON ai_drafts (email_hash);
CREATE INDEX IF NOT EXISTS ai_drafts_day_ip ON ai_drafts (day, ip_hash);
