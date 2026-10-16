-- Own page-view log for Pinterest-referred visits (lib/pinterest-visits.ts).
-- One counter per (day, utm_content, path). No IP, no user agent, no cookie, no
-- session id: nothing that identifies a visitor is stored. The worker also runs
-- this CREATE TABLE IF NOT EXISTS itself, so a deploy that precedes this migration
-- still counts visits instead of dropping them.
CREATE TABLE IF NOT EXISTS pinterest_visits (
  day TEXT NOT NULL,
  utm_content TEXT NOT NULL,
  path TEXT NOT NULL,
  visits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, utm_content, path)
);
