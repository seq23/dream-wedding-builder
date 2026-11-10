-- The AI draft's $0 chain (lib/ai-draft.ts): per-pool call counters (per provider
-- day and per minute), daily-quota "spent" marks, and the Gemini billing guard's
-- result for the Central day. Counters only: no email, no IP, no text. The route
-- also runs this CREATE TABLE IF NOT EXISTS itself, so a deploy that precedes
-- this migration still counts. Additive only.
CREATE TABLE IF NOT EXISTS ai_route_usage (
  key TEXT PRIMARY KEY,
  n INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ai_drafts_day_model ON ai_drafts (day, model);
