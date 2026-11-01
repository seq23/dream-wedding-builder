-- Free sample -> email -> paid, and the one post-purchase review ask (lib/nurture.ts).
-- Addresses live only in builder_signups and orders; these two tables hold a SHA-256
-- of the address. lib/nurture.ts also runs these CREATE TABLE IF NOT EXISTS itself.
CREATE TABLE IF NOT EXISTS email_sends (
  email_hash TEXT NOT NULL,
  kind TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  provider_message_id TEXT,
  PRIMARY KEY (email_hash, kind)
);
CREATE TABLE IF NOT EXISTS email_optouts (
  email_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
