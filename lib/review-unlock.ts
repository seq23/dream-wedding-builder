// Google Play review access (REVIEW-UNLOCK-DESIGN.md sections 3 and 4; Peace Be Still's worker/src/review.ts is the
// reference, KeepMyProof's site/server/review.mjs the sibling port). Dream Wedding has no accounts, so a Play reviewer
// reaches every paid part with ONE 10-digit code typed on the full-plan screen (Android only). The code lives only in
// the Worker secret REVIEW_CODE, the Boss OS vault (DW_PLAY_REVIEW_CODE) and Play Console's private sign-in details:
// never in the app or this public repo. The right code asks RevenueCat to grant this phone's anonymous purchase ID the
// three paid entitlements (full_plan, printables, day_of_kit) for 7 days. The content door (lib/app-unlock.ts) then
// delivers exactly as for a buyer, but only while a review_grant row from THIS window AND RevenueCat both say so.
//
// Order: window -> body and ID format -> try limits (atomic, BEFORE the compare) -> constant-time compare -> ID known to
// RevenueCat -> per-IP new-slot limit -> device slot (cap REVIEW_MAX_DEVICES per code version, reserved with
// expires_at 0, which opens no door) -> the three grants -> the row is made live. Any RevenueCat failure revokes all
// three GRANTED entitlements (never a purchase), gives the slot back and answers 503: never half-granted.
// Stored: HMACs of the ID and the IP (REVIEW_HASH_SECRET), the code version, timestamps. Never a raw ID, IP or code.
import { takeSlot, type LimitDB } from './abuse-limits';
import { REVENUECAT_PROJECT } from './revenuecat-project';

export type ReviewEntitlement = 'full_plan' | 'printables' | 'day_of_kit';
/** RevenueCat's ids for the Dream Wedding entitlements (identifiers, not secrets; read from v2 /entitlements 22 Nov 2026). */
export const ENTITLEMENT_IDS: Record<ReviewEntitlement, string> = { full_plan: 'entl05a6d2969d', printables: 'entlf54d225a65', day_of_kit: 'entl03763c2133' };
export const REVIEW_LIMITS = {
  burst: { max: 5, windowS: 60 }, perIp: { max: 20, windowS: 86400 }, global: { max: 1000, windowS: 86400 },
  newSlotsPerIp: { max: 2, windowS: 86400 }, maxDevices: 10,
} as const;
const RC = `https://api.revenuecat.com/v2/projects/${REVENUECAT_PROJECT}/customers`;
const CODE = /^\d{10}$/;
const ANON_ID = /^\$RCAnonymousID:[0-9a-f]{32}$/;
const DAY = 86_400_000, WEEK = 7 * DAY, MAX_BODY = 1024;
const OPEN_LOOPS_INTAKE = 'https://boss.sequoiataylor.com/api/boss/open-loops/intake';

export interface ReviewEnv {
  REVIEW_CODE?: string; REVIEW_CODE_VERSION?: string; REVIEW_UNTIL?: string; REVIEW_MAX_DEVICES?: string; REVIEW_HASH_SECRET?: string;
  REVENUECAT_SECRET?: string; APP_PURCHASES_ENABLED?: string; BOSS_OPEN_LOOPS_TOKEN?: string; DB?: LimitDB;
}
type Row = Record<string, unknown>;

const json = (body: object, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
const closed = () => json({ error: 'NOT_FOUND' }, 404);
const stop = (code: string) => console.error(JSON.stringify({ event: 'NAMED_STOP', stop: code, where: 'review-unlock' }));

/** Open only when every secret and binding it needs is present, the code is 10 digits and REVIEW_UNTIL is in the future.
 * Anything missing or malformed reads as closed: never "open with no check". */
export function reviewOpen(env: ReviewEnv, now: number): boolean {
  const until = Date.parse(env.REVIEW_UNTIL ?? '');
  return CODE.test(env.REVIEW_CODE ?? '') && Number.isFinite(until) && until > now &&
    /^[A-Za-z0-9._-]{1,32}$/.test(env.REVIEW_CODE_VERSION ?? '') && (env.REVIEW_HASH_SECRET ?? '').length >= 32 &&
    !!env.REVENUECAT_SECRET && env.APP_PURCHASES_ENABLED === 'true' && !!env.DB;
}
const maxDevices = (env: ReviewEnv) => { const n = Number(env.REVIEW_MAX_DEVICES ?? REVIEW_LIMITS.maxDevices); return Number.isInteger(n) && n > 0 && n <= 50 ? n : REVIEW_LIMITS.maxDevices; };

async function hmac(secret: string, text: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)));
}
const hex = (bytes: Uint8Array) => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
/** Constant time: both sides are HMAC'd to 32 bytes first, then every byte is compared. */
async function same(secret: string, typed: string, real: string) {
  const [a, b] = await Promise.all([hmac(secret, `code:${typed}`), hmac(secret, `code:${real}`)]);
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
export const reviewIdHash = async (env: ReviewEnv, id: string) => hex(await hmac(env.REVIEW_HASH_SECRET!, `id:${id}`));
/** The one review event a grant pays for: fixed per (code version, ID), so it binds to exactly one event on the phone. */
export const reviewEventToken = async (env: ReviewEnv, idHash: string) => hex(await hmac(env.REVIEW_HASH_SECRET!, `event:${env.REVIEW_CODE_VERSION}:${idHash}`));
/** Gives back the newest try in a limiter bucket (the slot was not used). */
const giveBack = (db: LimitDB, bucket: string, key: string) =>
  db.prepare('DELETE FROM rate_events WHERE rowid = (SELECT rowid FROM rate_events WHERE bucket = ? AND key = ? ORDER BY at DESC LIMIT 1)').bind(bucket, key).run();

export function reviewStatus(env: ReviewEnv, now = Date.now()): Response {
  return reviewOpen(env, now) ? json({ open: true }) : closed();
}

/** POST /api/review/unlock. `fetcher` reaches RevenueCat and the Open Loops intake. */
export async function reviewUnlock(request: Request, env: ReviewEnv, fetcher: typeof fetch = fetch, now = Date.now()): Promise<Response> {
  if (!reviewOpen(env, now)) return closed();
  // Body: JSON only, at most 1 KB, a code and RevenueCat's anonymous ID. Anything else is refused before any count or call.
  const length = Number(request.headers.get('content-length') ?? 0);
  if (!/^application\/json\b/i.test(request.headers.get('content-type') ?? '') || length > MAX_BODY) return json({ error: 'BAD_REQUEST' }, 400);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: 'BAD_REQUEST' }, 400);
  let body: Row | null;
  try { body = JSON.parse(raw); } catch { return json({ error: 'BAD_REQUEST' }, 400); }
  const code = body?.code, id = body?.app_user_id;
  if (typeof code !== 'string' || typeof id !== 'string' || !ANON_ID.test(id)) return json({ error: 'BAD_REQUEST' }, 400);

  const db = env.DB!, secret = env.REVIEW_HASH_SECRET!, version = env.REVIEW_CODE_VERSION!;
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const ipHash = hex(await hmac(secret, `ip:${ip}`)), idHash = await reviewIdHash(env, id);
  const s = Math.floor(now / 1000);
  try {
    // Limits, taken before the code is compared, so guessing costs a try whatever the guess.
    if (!await takeSlot(db, 'review-burst', ipHash, REVIEW_LIMITS.burst, s)) return json({ error: 'SLOW_DOWN' }, 429);
    if (!await takeSlot(db, 'review-ip', ipHash, REVIEW_LIMITS.perIp, s)) { stop('REVIEW_IP_DAILY_CAP'); return json({ error: 'SLOW_DOWN' }, 429); }
    if (!await takeSlot(db, 'review-all', 'all', REVIEW_LIMITS.global, s)) { stop('REVIEW_DAILY_CAP'); return json({ error: 'SLOW_DOWN' }, 429); }
  } catch { stop('REVIEW_DB_UNAVAILABLE'); return json({ error: 'TRY_AGAIN' }, 503); }

  if (!CODE.test(code) || !await same(secret, code, env.REVIEW_CODE!)) { stop('REVIEW_CODE_WRONG'); return json({ error: 'WRONG_CODE' }, 403); }

  const rc = (path: string, init: RequestInit = {}) => fetcher(`${RC}/${encodeURIComponent(id)}${path}`, {
    ...init, headers: { Authorization: `Bearer ${env.REVENUECAT_SECRET}`, 'content-type': 'application/json', Accept: 'application/json' },
    signal: AbortSignal.timeout(8000), redirect: 'manual',
  });
  // The ID must be one RevenueCat already knows (the SDK creates it on first launch): a made-up ID takes no slot.
  try {
    const known = await rc('');
    if (known.status === 404) { stop('REVIEW_ID_UNKNOWN'); return json({ error: 'TRY_AGAIN' }, 503); }
    if (!known.ok) throw Error(`HTTP_${known.status}`);
  } catch { stop('REVIEW_RC_UNAVAILABLE'); return json({ error: 'TRY_AGAIN' }, 503); }

  // Device slot: the same ID again takes no new slot (and gets a fresh grant); a new ID takes one of REVIEW_MAX_DEVICES,
  // and one IP may open at most 2 new slots a day, so a leaked code cannot burn every slot at once.
  const expires = Math.min(now + WEEK, Date.parse(env.REVIEW_UNTIL!));
  let newSlot = false, ipSlot = false;
  try {
    const had = await db.prepare('SELECT 1 AS x FROM review_grant WHERE window_id = ? AND id_hash = ?').bind(version, idHash).first();
    if (!had) {
      if (!await takeSlot(db, 'review-slot-ip', ipHash, REVIEW_LIMITS.newSlotsPerIp, s)) { stop('REVIEW_IP_SLOT_CAP'); return json({ error: 'USED_UP' }, 403); }
      ipSlot = true;
      // Reserved with expires_at 0: it counts against the cap at once (atomic), but opens no door until every grant is made.
      const row = await db.prepare('INSERT INTO review_grant (window_id, id_hash, granted_at, expires_at) SELECT ?, ?, ?, 0 WHERE (SELECT COUNT(*) FROM review_grant WHERE window_id = ?) < ? ON CONFLICT(window_id, id_hash) DO NOTHING RETURNING id_hash')
        .bind(version, idHash, now, version, maxDevices(env)).first();
      if (!row) {
        await giveBack(db, 'review-slot-ip', ipHash);
        stop('REVIEW_DEVICE_CAP');
        await fileCapLoop(env, fetcher);
        return json({ error: 'USED_UP' }, 403);
      }
      newSlot = true;
    }
  } catch {
    if (ipSlot) await giveBack(db, 'review-slot-ip', ipHash).catch(() => {});
    stop('REVIEW_DB_UNAVAILABLE'); return json({ error: 'TRY_AGAIN' }, 503);
  }

  // Three grants, all or none. A timeout may still have granted, so a failure revokes all three GRANTED entitlements
  // (revoke_granted_entitlement never touches a purchase), gives the slot back and answers "try again".
  const ids = Object.values(ENTITLEMENT_IDS);
  let readonly = false;
  try {
    for (const entitlement of ids) {
      const res = await rc('/actions/grant_entitlement', { method: 'POST', body: JSON.stringify({ entitlement_id: entitlement, expires_at: expires }) });
      if (res.status === 403) readonly = true;
      if (!res.ok) throw Error(`HTTP_${res.status}`);
    }
    // Live only now: the row opens the door from here on, until expires_at.
    await db.prepare('UPDATE review_grant SET granted_at = ?, expires_at = ? WHERE window_id = ? AND id_hash = ?').bind(now, expires, version, idHash).run();
  } catch {
    for (const entitlement of ids) await rc('/actions/revoke_granted_entitlement', { method: 'POST', body: JSON.stringify({ entitlement_id: entitlement }) }).catch(() => {});
    if (newSlot) await db.prepare('DELETE FROM review_grant WHERE window_id = ? AND id_hash = ?').bind(version, idHash).run().catch(() => {});
    if (ipSlot) await giveBack(db, 'review-slot-ip', ipHash).catch(() => {});
    stop(readonly ? 'REVIEW_RC_KEY_READONLY' : 'REVIEW_RC_UNAVAILABLE');
    return json({ error: 'TRY_AGAIN' }, 503);
  }
  console.log(JSON.stringify({ event: 'REVIEW_UNLOCKED', window: version }));
  return json({ unlocked: true });
}

/**
 * The door's side (lib/app-unlock.ts): the entitlements a review grant gives this ID right now. Needs ALL of: the window
 * open, a live review_grant row for this code version, and RevenueCat's active_entitlements still showing a dated
 * (granted, not purchased) entitlement. Any failure is "no review grant": real purchases are decided elsewhere, unchanged.
 */
export async function reviewEntitlements(id: string, env: ReviewEnv, upstream: typeof fetch, now: number): Promise<{ active: ReviewEntitlement[]; idHash: string | null }> {
  const none = { active: [] as ReviewEntitlement[], idHash: null };
  if (!reviewOpen(env, now) || !ANON_ID.test(id)) return none;
  try {
    const idHash = await reviewIdHash(env, id);
    const row = await env.DB!.prepare('SELECT expires_at FROM review_grant WHERE window_id = ? AND id_hash = ?').bind(env.REVIEW_CODE_VERSION, idHash).first();
    if (!row || !(Number(row.expires_at) > now)) return none;
    const res = await upstream(`${RC}/${encodeURIComponent(id)}/active_entitlements?limit=20`, {
      headers: { Authorization: `Bearer ${env.REVENUECAT_SECRET}`, Accept: 'application/json' }, signal: AbortSignal.timeout(8000), redirect: 'manual',
    });
    if (!res.ok) throw Error(`HTTP_${res.status}`);
    const items = (await res.json() as { items?: unknown }).items;
    const live = new Set((Array.isArray(items) ? items : []).flatMap(v => {
      const item = (v ?? {}) as Row;
      return typeof item.entitlement_id === 'string' && typeof item.expires_at === 'number' && item.expires_at > now ? [item.entitlement_id] : [];
    }));
    return { active: (Object.keys(ENTITLEMENT_IDS) as ReviewEntitlement[]).filter(name => live.has(ENTITLEMENT_IDS[name])), idHash };
  } catch { stop('REVIEW_DOOR_UNAVAILABLE'); return none; }
}

/** Hourly cron (worker.ts): rows 7 days past their expiry (or a reservation abandoned mid-call) and review try counters
 * older than a day are deleted, so no HMAC'd ID or IP outlives its use. */
export async function purgeReviewRows(db: LimitDB, now = Date.now()) {
  await db.prepare('DELETE FROM review_grant WHERE MAX(expires_at, granted_at) + ? < ?').bind(WEEK, now).run();
  await db.prepare("DELETE FROM rate_events WHERE bucket LIKE 'review-%' AND at <= ?").bind(Math.floor(now / 1000) - 86400).run();
}

/** The cap was hit: a row on Boss OS's Open Loops list, so it is seen, not only logged. */
async function fileCapLoop(env: ReviewEnv, fetcher: typeof fetch) {
  if (!env.BOSS_OPEN_LOOPS_TOKEN) { stop('OPEN_LOOPS_TOKEN_MISSING'); return; }
  try {
    const r = await fetcher(OPEN_LOOPS_INTAKE, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${env.BOSS_OPEN_LOOPS_TOKEN}` },
      body: JSON.stringify({
        repo: 'seq23/dream-wedding-builder', stop: 'REVIEW_DEVICE_CAP', business: 'spry', owner: 'claude',
        finish_line: 'Dream Wedding: live on Google Play, selling',
        title: 'Dream Wedding: the Play review code is used up',
        next_step: `All ${maxDevices(env)} phones allowed for the current Play review code have used it. Make a new code in the vault and on the live site, then Sequoia pastes the new code into Play Console.`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) stop('OPEN_LOOPS_REFUSED');
  } catch { stop('OPEN_LOOPS_UNREACHABLE'); }
}
