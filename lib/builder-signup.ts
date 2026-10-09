// The free planning builder asks for an email before it opens. This module is the
// single definition of what the visitor agrees to and how the address is stored.
// Nothing here sends email.

export const BUILDER_ACCESS_KEY = 'dwb-builder-access';

export const CONSENT_TEXT =
  'Email me wedding planning tips and occasional offers from Dream Wedding Builder. I can unsubscribe at any time.';

export const UNSUBSCRIBE_NOTE =
  'Every email includes an unsubscribe link, or write to info@weddingchecklistpdf.com and we remove your address.';

export const BUILDER_SIGNUPS_DDL = `CREATE TABLE IF NOT EXISTS builder_signups (
  email TEXT PRIMARY KEY,
  consent_text TEXT NOT NULL,
  source TEXT,
  host TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unsubscribed_at TEXT
)`;

export function normalizeEmail(raw: unknown): string | null {
  const email = String(raw ?? '').trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

type D1Like = { prepare(sql: string): { bind(...values: unknown[]): { run(): Promise<unknown> }; run(): Promise<unknown> } };

export async function storeBuilderSignup(db: D1Like, input: { email: string; source: string; host: string }) {
  await db.prepare(BUILDER_SIGNUPS_DDL).run();
  await db
    .prepare(
      `INSERT INTO builder_signups (email, consent_text, source, host) VALUES (?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP`
    )
    .bind(input.email, CONSENT_TEXT, input.source, input.host)
    .run();
}
