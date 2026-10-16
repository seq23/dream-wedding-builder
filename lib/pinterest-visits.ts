// Own page-view log for the Pinterest drip (worker.ts calls this on every request).
// Cloudflare Web Analytics drops query strings, so utm_content (= the pin variant
// id) is unreadable there; this counts Pinterest-referred visits per variant in D1
// so scripts/pinterest/collect_metrics.mjs can report real numbers.
// Records ONLY requests whose query carries utm_source=pinterest; stores day,
// utm_content, path and a counter. No IP, no user agent, no cookie, no session id.

export const LAUNCH_VARIANT = '(launch item, no utm_content)';
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless/i;

export const CREATE_SQL = `CREATE TABLE IF NOT EXISTS pinterest_visits (
  day TEXT NOT NULL,
  utm_content TEXT NOT NULL,
  path TEXT NOT NULL,
  visits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, utm_content, path)
)`;

const UPSERT_SQL = `INSERT INTO pinterest_visits (day, utm_content, path, visits) VALUES (?, ?, ?, 1)
  ON CONFLICT (day, utm_content, path) DO UPDATE SET visits = visits + 1`;

type D1Like = { prepare(sql: string): { bind(...args: unknown[]): { run(): Promise<unknown> }; run?(): Promise<unknown> } };

/** The visit to record, or null when this request is not a Pinterest-referred page view. */
export function pinterestVisit(request: Request, now: Date = new Date()): { day: string; utm_content: string; path: string } | null {
  if (request.method !== 'GET') return null;
  let url: URL;
  try { url = new URL(request.url); } catch { return null; }
  if ((url.searchParams.get('utm_source') ?? '').toLowerCase() !== 'pinterest') return null;
  if (BOT.test(request.headers.get('user-agent') ?? '')) return null;
  const variant = (url.searchParams.get('utm_content') ?? '').replace(/[^a-zA-Z0-9_\-.:]/g, '').slice(0, 120);
  return { day: now.toISOString().slice(0, 10), utm_content: variant || LAUNCH_VARIANT, path: url.pathname.slice(0, 200) };
}

let tableReady = false;
/** Count the visit. Returns true when a row was written; never throws into the request. */
export async function recordPinterestVisit(db: D1Like | undefined, request: Request, now: Date = new Date()): Promise<boolean> {
  const visit = pinterestVisit(request, now);
  if (!visit || !db) return false;
  try {
    if (!tableReady) { await db.prepare(CREATE_SQL).bind().run(); tableReady = true; }
    await db.prepare(UPSERT_SQL).bind(visit.day, visit.utm_content, visit.path).run();
    return true;
  } catch (error) {
    console.error(JSON.stringify({ event: 'PINTEREST_VISIT_LOG_FAILED', error: error instanceof Error ? error.message : String(error) }));
    return false;
  }
}

export function _resetForTests() { tableReady = false; }
