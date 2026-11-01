-- Sales and signups from visitors who arrived from a pin (lib/pinterest-conversions.ts).
-- One row per (kind, ref): ref is the order id for a sale, an opaque hash for a signup.
-- No email, no IP, no user agent. The routes also run this CREATE TABLE IF NOT EXISTS
-- themselves, so a deploy that precedes this migration still records conversions.
CREATE TABLE IF NOT EXISTS pinterest_conversions (
  day TEXT NOT NULL,
  utm_content TEXT NOT NULL,
  kind TEXT NOT NULL,
  ref TEXT NOT NULL,
  PRIMARY KEY (kind, ref)
);
