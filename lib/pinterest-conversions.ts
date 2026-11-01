// Pin visit -> sale / signup (owner-approved 1 Nov 2026). A visit that arrives from a
// pin (utm_source=pinterest) gets a first-party cookie naming the pin (middleware.ts);
// checkout carries it into the Stripe session metadata (app/api/checkout) and the paid
// webhook records a 'sale' here; the free-planner signup records a 'signup'. Stored:
// day, pin id, kind and an opaque reference (the order id, or a hash for a signup).
// No email, no IP, no user agent. scripts/pinterest/collect_metrics.mjs counts them weekly.

export const PIN_COOKIE = 'dwb_pin';
export const PIN_COOKIE_MAX_AGE = 30 * 86400; // a wedding purchase is rarely same-visit

export const CREATE_SQL = `CREATE TABLE IF NOT EXISTS pinterest_conversions (
  day TEXT NOT NULL,
  utm_content TEXT NOT NULL,
  kind TEXT NOT NULL,
  ref TEXT NOT NULL,
  PRIMARY KEY (kind, ref)
)`;

const INSERT_SQL = 'INSERT INTO pinterest_conversions (day, utm_content, kind, ref) VALUES (?, ?, ?, ?) ON CONFLICT (kind, ref) DO NOTHING';

/** The pin id to remember for a pin-referred request, or null when the request did not come from a pin. */
export function pinRefFromUrl(url: URL): string | null {
  if ((url.searchParams.get('utm_source') ?? '').toLowerCase() !== 'pinterest') return null;
  return cleanPinRef(url.searchParams.get('utm_content')) ?? 'launch';
}

/** A cookie or metadata value reduced to a safe pin id, or null. */
export function cleanPinRef(value: string | null | undefined): string | null {
  const v = String(value ?? '').replace(/[^a-zA-Z0-9_\-.:]/g, '').slice(0, 120);
  return v || null;
}

type D1Like = { prepare(sql: string): { bind(...args: unknown[]): { run(): Promise<unknown> } } };

/** Record one conversion from a pin visitor. Never throws into the caller (a sale is never failed by this). */
export async function recordPinterestConversion(db: D1Like | undefined, entry: { kind: 'sale' | 'signup'; pinRef: string | null | undefined; ref: string; now?: Date }): Promise<boolean> {
  const pin = cleanPinRef(entry.pinRef);
  if (!db || !pin || !entry.ref) return false;
  try {
    await db.prepare(CREATE_SQL).bind().run();
    await db.prepare(INSERT_SQL).bind((entry.now ?? new Date()).toISOString().slice(0, 10), pin, entry.kind, entry.ref.slice(0, 120)).run();
    return true;
  } catch (error) {
    console.error(JSON.stringify({ event: 'PINTEREST_CONVERSION_LOG_FAILED', error: error instanceof Error ? error.message : String(error) }));
    return false;
  }
}

/** Opaque, stable reference for a signup: never the email itself. */
export async function signupRef(email: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`dwb-pin-signup:${email}`));
  return `signup:${[...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}
