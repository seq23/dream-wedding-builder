-- Per-IP limits for the sample form, the builder email gate and the admin login
-- (lib/abuse-limits.ts). key is a SHA-256 of the caller's IP; the address is never stored.
-- The code also runs these CREATE ... IF NOT EXISTS itself, so a deploy that precedes
-- this migration still limits instead of failing.
CREATE TABLE IF NOT EXISTS rate_events (
  bucket TEXT NOT NULL,
  key TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_events_lookup ON rate_events (bucket, key, at);
