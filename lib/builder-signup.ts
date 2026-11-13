// The free planning builder asks for an email before it opens. This module is the
// single definition of what the visitor agrees to and how the address is stored.
// Nothing here sends email.

export const BUILDER_ACCESS_KEY = 'dwb-builder-access';
/** The address the visitor opened the builder with, kept in their own browser so the AI draft step can name it. */
export const BUILDER_EMAIL_KEY = 'dwb-builder-email';

export const CONSENT_TEXT =
  'Email me wedding planning tips and occasional offers from Dream Wedding. I can unsubscribe at any time.';

/**
 * What the couple agrees to before their sentence leaves the site (Apple 5.1.2:
 * name who receives it, ask first). The AI draft card shows it beside a required
 * tick box, and the server asks no model unless that box was ticked.
 */
export const AI_CONSENT_TEXT =
  'Send my sentence to a free AI model from Google Gemini or OpenRouter, which may keep it. I have left out names and anything private.';

/** Said by the server (429) and by the card on her own device once the free draft is used: one sentence, one source. */
export const AI_DRAFT_USED_TEXT =
  'You have used your free AI draft for this email. Your plan is yours to edit by hand below, and that stays free.';

export const UNSUBSCRIBE_NOTE =
  'Every email includes an unsubscribe link, or write to info@weddingchecklistpdf.com and we remove your address.';

/** Stored as the consent text of an address given WITHOUT the marketing tick. */
export const NO_MARKETING_TEXT = 'No marketing emails. Address given to print the plan or to use the free AI draft.';

export const BUILDER_SIGNUPS_DDL = `CREATE TABLE IF NOT EXISTS builder_signups (
  email TEXT PRIMARY KEY,
  consent_text TEXT NOT NULL,
  source TEXT,
  host TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unsubscribed_at TEXT,
  marketing_consent INTEGER
)`;

/**
 * marketing_consent (migration 0008, additive): 1 = she ticked the optional box,
 * 0 = she gave her email without it, NULL = a row from before 10 Nov 2026, when the
 * box was compulsory, so NULL counts as consented. Only 1 and NULL may be emailed
 * marketing; lib/nurture.ts reads exactly this rule through MARKETING_OK_SQL.
 */
export const MARKETING_COLUMN_DDL = 'ALTER TABLE builder_signups ADD COLUMN marketing_consent INTEGER';
export const MARKETING_OK_SQL = '(marketing_consent IS NULL OR marketing_consent = 1)';

export function normalizeEmail(raw: unknown): string | null {
  const email = String(raw ?? '').trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null;
}

type Bound = { run(): Promise<unknown>; first?(): Promise<unknown> };
type D1Like = { prepare(sql: string): { bind(...values: unknown[]): Bound; run(): Promise<unknown> } };

/** Creates the table on a fresh database and adds the column to one that predates it. Additive; safe to call every time. */
export async function ensureSignupTable(db: D1Like) {
  await db.prepare(BUILDER_SIGNUPS_DDL).run();
  const has = await db.prepare("SELECT 1 AS present FROM pragma_table_info('builder_signups') WHERE name = ?").bind('marketing_consent').first?.();
  if (!has) { try { await db.prepare(MARKETING_COLUMN_DDL).run(); } catch { /* another request added it first */ } }
}

/**
 * `marketing` true = she ticked the optional box (or used a form whose box is the
 * point of the form, like the free sample). A later visit can turn consent on, never
 * silently off: turning it off is the unsubscribe link's job.
 */
export async function storeBuilderSignup(db: D1Like, input: { email: string; source: string; host: string; marketing?: boolean }) {
  const marketing = input.marketing !== false;
  await ensureSignupTable(db);
  await db
    .prepare(
      `INSERT INTO builder_signups (email, consent_text, source, host, marketing_consent) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP,
         consent_text = CASE WHEN excluded.marketing_consent = 1 AND builder_signups.marketing_consent = 0 THEN excluded.consent_text ELSE builder_signups.consent_text END,
         marketing_consent = CASE WHEN excluded.marketing_consent = 1 AND builder_signups.marketing_consent = 0 THEN 1 ELSE builder_signups.marketing_consent END`
    )
    .bind(input.email, marketing ? CONSENT_TEXT : NO_MARKETING_TEXT, input.source, input.host, marketing ? 1 : 0)
    .run();
}
