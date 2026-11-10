// The free planning builder asks for an email before it opens. This module is the
// single definition of what the visitor agrees to and how the address is stored.
// Nothing here sends email.

export const BUILDER_ACCESS_KEY = 'dwb-builder-access';
/** The address the visitor opened the builder with, kept in their own browser so the AI draft step can name it. */
export const BUILDER_EMAIL_KEY = 'dwb-builder-email';

export const CONSENT_TEXT =
  'Email me wedding planning tips and occasional offers from Dream Wedding Builder. I can unsubscribe at any time.';

/**
 * What the couple agrees to before their sentence leaves the site (Apple 5.1.2:
 * name who receives it, ask first). The AI draft card shows it beside a required
 * tick box, and the server asks no model unless that box was ticked.
 */
export const AI_CONSENT_TEXT =
  'Send my sentence to a free AI model from Google Gemini or OpenRouter, which may keep it. I have left out names and anything private.';

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
