// The standout-idea form's store (27 Nov 2026). Before this, /api/submit-trend forwarded each
// idea to an Apps Script sheet that was never configured, so it answered "we received your
// idea" and kept nothing. Now every idea is one row in the site's own D1, written before the
// visitor is told it was received, and read only on the owner-signed-in /admin page.
//
// The caller's address is never stored: ip_hash is a salted SHA-256 of the address Cloudflare
// saw (the same shape as ai_drafts and wedding_reads). is_test is never set from the request;
// the owner marks a TEST row afterwards (UPDATE trend_ideas SET is_test = 1 WHERE id = ?).
// The code runs the CREATE ... IF NOT EXISTS itself, like rate_events, so a deploy that comes
// before migrations/0016_trend_ideas.sql still keeps ideas instead of failing.

export const TREND_IDEAS_DDL = `CREATE TABLE IF NOT EXISTS trend_ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submitted_at TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  idea_name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  budget_feel TEXT NOT NULL DEFAULT '',
  why_cool TEXT NOT NULL DEFAULT '',
  price_this_out INTEGER NOT NULL DEFAULT 0,
  is_test INTEGER NOT NULL DEFAULT 0
)`;

type Row = Record<string, unknown>;
export type IdeasDB = {
  prepare(sql: string): {
    bind(...v: unknown[]): { run(): Promise<unknown>; first<T = Row>(): Promise<T | null>; all<T = Row>(): Promise<{ results?: T[] }> };
    run(): Promise<unknown>;
  };
};

/** What the visitor sees whenever the idea was not written. Never the success line. */
export const IDEA_NOT_SAVED = 'We couldn’t save your idea just now. Please try again in a few minutes.';

/** The longest each field may be; the form's own maxLength matches, so only a script is cut. */
export const IDEA_LIMITS = { idea_name: 120, description: 1000, source_type: 80, source_url: 500, category: 80, budget_feel: 80, why_cool: 750 } as const;
/** A whole request body larger than this is refused (413) before it is parsed. */
export const IDEA_BODY_MAX_BYTES = 8 * 1024;

export type TrendIdea = {
  idea_name: string;
  description: string;
  category: string;
  source_type: string;
  source_url: string;
  budget_feel: string;
  why_cool: string;
  price_this_out: boolean;
};

export type StoredIdea = TrendIdea & { id: number; submitted_at: string; is_test: boolean };

const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

/** The idea as it will be stored, or the first required field that is empty. */
export function cleanIdea(body: Record<string, unknown>): { idea: TrendIdea } | { missing: string } {
  const idea: TrendIdea = {
    idea_name: text(body.idea_name, IDEA_LIMITS.idea_name),
    description: text(body.description, IDEA_LIMITS.description),
    category: text(body.category, IDEA_LIMITS.category),
    source_type: text(body.source_type, IDEA_LIMITS.source_type),
    source_url: text(body.source_url, IDEA_LIMITS.source_url),
    budget_feel: text(body.budget_feel || 'No idea', IDEA_LIMITS.budget_feel),
    why_cool: text(body.why_cool, IDEA_LIMITS.why_cool),
    // A checkbox posts "on"; a script may post true. Anything else, including "false", is no.
    price_this_out: body.price_this_out === true || body.price_this_out === 'on'
  };
  for (const field of ['idea_name', 'description', 'category'] as const) if (!idea[field]) return { missing: field };
  return { idea };
}

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** A salted one-way hash of the address Cloudflare saw. Never the address itself. */
export async function ideaIpHash(headers: Headers, salt: string): Promise<string> {
  const ip = headers.get('cf-connecting-ip') ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  return sha256(`${salt}:ip:${ip}`);
}

/** Writes one idea and returns its id. Throws when the row was not written. */
export async function saveIdea(db: IdeasDB, idea: TrendIdea, ipHash: string, now = new Date()): Promise<number> {
  await db.prepare(TREND_IDEAS_DDL).run();
  const row = await db
    .prepare('INSERT INTO trend_ideas (submitted_at, ip_hash, idea_name, description, category, source_type, source_url, budget_feel, why_cool, price_this_out) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id')
    .bind(now.toISOString(), ipHash, idea.idea_name, idea.description, idea.category, idea.source_type, idea.source_url, idea.budget_feel, idea.why_cool, idea.price_this_out ? 1 : 0)
    .first<{ id: number }>();
  const id = Number(row?.id);
  if (!Number.isInteger(id) || id < 1) throw new Error('trend_ideas insert returned no id');
  return id;
}

export const IDEAS_PAGE_SIZE = 50;

/** One page of ideas, newest first; `before` is the id to page below. Throws when unreadable. */
export async function listIdeas(db: IdeasDB, before?: number): Promise<{ ideas: StoredIdea[]; total: number; older: number | null }> {
  await db.prepare(TREND_IDEAS_DDL).run();
  const below = Number.isInteger(before) && before! > 0 ? before! : Number.MAX_SAFE_INTEGER;
  const page = await db
    .prepare('SELECT id, submitted_at, idea_name, description, category, source_type, source_url, budget_feel, why_cool, price_this_out, is_test FROM trend_ideas WHERE id < ? ORDER BY id DESC LIMIT ?')
    .bind(below, IDEAS_PAGE_SIZE + 1)
    .all<Row>();
  const count = await db.prepare('SELECT COUNT(*) AS n FROM trend_ideas').bind().first<{ n: number }>();
  if (!page || !Array.isArray(page.results) || !count) throw new Error('trend_ideas could not be read');
  const rows = page.results.slice(0, IDEAS_PAGE_SIZE).map((r) => ({
    id: Number(r.id),
    submitted_at: String(r.submitted_at),
    idea_name: String(r.idea_name),
    description: String(r.description),
    category: String(r.category),
    source_type: String(r.source_type ?? ''),
    source_url: String(r.source_url ?? ''),
    budget_feel: String(r.budget_feel ?? ''),
    why_cool: String(r.why_cool ?? ''),
    price_this_out: Number(r.price_this_out) === 1,
    is_test: Number(r.is_test) === 1
  }));
  return { ideas: rows, total: Number(count.n), older: page.results.length > IDEAS_PAGE_SIZE ? rows[rows.length - 1].id : null };
}
