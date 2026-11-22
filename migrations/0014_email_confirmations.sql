-- Double opt-in for the sample's three planning emails (launch kit, 21 Nov 2026). The hash of an
-- address whose owner clicked the signed download link in the sample email. Additive only; no
-- existing row changes. lib/nurture.ts (NURTURE_DDL) creates the same table on first use.
CREATE TABLE IF NOT EXISTS email_confirmations (
  email_hash TEXT PRIMARY KEY,
  confirmed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS schema_version (
  migration TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO schema_version (migration) VALUES ('0014_email_confirmations');
