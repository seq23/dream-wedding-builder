// Per-IP limits for the public forms and the admin login (security sweep, 3 Nov 2026).
//
// The numbers live here and nowhere else. Every event is a row in rate_events keyed by a
// SHA-256 of the caller's IP (the address itself is never stored), counted over a rolling
// window, so a burst cannot slip between two fixed buckets. The daily ceiling on emails
// the site sends is NURTURE_DAILY_SEND_CEILING in lib/nurture.ts.

export const LIMITS = {
  // The free sample form emails the typed address: 3 tries an hour from one IP.
  sample: { max: 3, windowS: 3600 },
  // The builder email gate only stores the address (nothing is sent): 10 an hour from one IP.
  builderSignup: { max: 10, windowS: 3600 },
  // Admin login: 10 wrong passwords in 15 minutes locks that IP out for the rest of the window.
  adminLoginFail: { max: 10, windowS: 900 }
} as const;

export const RATE_EVENTS_DDL = `CREATE TABLE IF NOT EXISTS rate_events (
  bucket TEXT NOT NULL,
  key TEXT NOT NULL,
  at INTEGER NOT NULL
)`;
const RATE_EVENTS_INDEX = 'CREATE INDEX IF NOT EXISTS rate_events_lookup ON rate_events (bucket, key, at)';

type Row = Record<string, unknown>;
export type LimitDB = {
  prepare(sql: string): { bind(...v: unknown[]): { run(): Promise<unknown>; first(): Promise<Row | null> }; run(): Promise<unknown> };
};

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The caller's IP as Cloudflare saw it, hashed. Never the raw address. */
export async function callerKey(headers: Headers): Promise<string> {
  const ip = headers.get('cf-connecting-ip') ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  return sha256(`ip:${ip}`);
}

async function ensure(db: LimitDB) {
  await db.prepare(RATE_EVENTS_DDL).run();
  await db.prepare(RATE_EVENTS_INDEX).run();
}

const nowS = () => Math.floor(Date.now() / 1000);

/** Takes one slot if the caller is under the limit; false = over the limit, nothing recorded. Atomic. */
export async function takeSlot(db: LimitDB, bucket: string, key: string, limit: { max: number; windowS: number }, now = nowS()): Promise<boolean> {
  await ensure(db);
  await db.prepare('DELETE FROM rate_events WHERE bucket = ? AND key = ? AND at <= ?').bind(bucket, key, now - limit.windowS).run();
  const res = (await db
    .prepare('INSERT INTO rate_events (bucket, key, at) SELECT ?1, ?2, ?3 WHERE (SELECT COUNT(*) FROM rate_events WHERE bucket = ?1 AND key = ?2 AND at > ?4) < ?5')
    .bind(bucket, key, now, now - limit.windowS, limit.max)
    .run()) as { meta?: { changes?: number } };
  return res?.meta?.changes === 1;
}

/** True while the caller has used up the limit (for failure-counted limits such as a login). */
export async function isLockedOut(db: LimitDB, bucket: string, key: string, limit: { max: number; windowS: number }, now = nowS()): Promise<boolean> {
  await ensure(db);
  const row = await db.prepare('SELECT COUNT(*) AS n FROM rate_events WHERE bucket = ? AND key = ? AND at > ?').bind(bucket, key, now - limit.windowS).first();
  return Number(row?.n ?? 0) >= limit.max;
}

export async function recordEvent(db: LimitDB, bucket: string, key: string, now = nowS()) {
  await ensure(db);
  await db.prepare('INSERT INTO rate_events (bucket, key, at) VALUES (?, ?, ?)').bind(bucket, key, now).run();
}

export const TOO_MANY = 'Too many tries from this connection. Please wait a little and try again.';
