import { callerKey, takeSlot, type LimitDB } from './abuse-limits';

export const SHARE_MAX_BYTES = 64 * 1024;
export const SHARE_DAILY_REQUESTS = 10000;
export const SHARE_DAILY_WRITES = 4000; // 3,000 creates + 1,000 updates; target-day test before enabling.
export const SHARE_IP_LIMIT = { max: 120, windowS: 60 };
const ID = /^[a-f0-9]{64}$/;
const missing = () => reply(404, { error: 'Shared plan unavailable.' });
const reply = (status: number, body: object) => Response.json(body, { status, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
const limited = () => reply(429, { error: 'Sharing is busy. Please try again later.' });

// The encryption key stays in the phone's link fragment. This service cannot inspect
// or attest to the ciphertext, and MUST NOT be used as evidence of a paid purchase.
export async function planShare(req: Request, db: LimitDB | undefined, enabled: boolean, now = Date.now()): Promise<Response> {
  if (!enabled || !db) return reply(503, { error: 'Sharing is not available yet.' });
  const write = req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE';
  if (!write && req.method !== 'GET') return reply(405, { error: 'Method unavailable.' });
  if (Number(req.headers.get('content-length')) > SHARE_MAX_BYTES) return reply(413, { error: 'Shared plan is too large.' });
  try {
    const day = new Date(now).toISOString().slice(0, 10);
    const capacity = await db.prepare(`INSERT INTO app_share_capacity(day, requests, writes) VALUES (?1, 1, ?2)
      ON CONFLICT(day) DO UPDATE SET requests = requests + 1, writes = writes + ?2
      WHERE requests < ?3 AND writes + ?2 <= ?4`).bind(day, write ? 1 : 0, SHARE_DAILY_REQUESTS, SHARE_DAILY_WRITES).run() as { meta?: { changes?: number } };
    if (capacity.meta?.changes !== 1) return limited();
    if (!(await takeSlot(db, 'app-share', await callerKey(req.headers), SHARE_IP_LIMIT, Math.floor(now / 1000)))) return limited();
    const id = new URL(req.url).searchParams.get('id') ?? '';
    if (req.method !== 'POST' && !ID.test(id)) return missing();
    if (req.method === 'GET') {
      const row = await db.prepare('SELECT ciphertext, revision FROM app_plan_shares WHERE id = ? AND expires_at > ?').bind(id, now).first();
      return row ? reply(200, row) : missing();
    }
    // The random id is the transport capability; the separate encryption key is
    // never sent here. Stopping sharing deletes the capability on the server.
    if (req.method === 'DELETE') {
      await db.prepare('DELETE FROM app_plan_shares WHERE id = ?').bind(id).run();
      return reply(200, { ok: true });
    }
    const reader = req.body?.getReader();
    if (!reader) return reply(400, { error: 'Invalid shared plan.' });
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > SHARE_MAX_BYTES) { await reader.cancel(); return reply(413, { error: 'Shared plan is too large.' }); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let body: { ciphertext?: unknown; revision?: unknown };
    try { body = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { return reply(400, { error: 'Invalid shared plan.' }); }
    if (!body || typeof body.ciphertext !== 'string' || body.ciphertext.length < 40 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.ciphertext)) return reply(400, { error: 'Invalid shared plan.' });
    if (req.method === 'POST') {
      const random = crypto.getRandomValues(new Uint8Array(32));
      const created = Array.from(random, b => b.toString(16).padStart(2, '0')).join('');
      // Bounded cleanup, using the expiry index; capacity rows retain only two days.
      await db.prepare('DELETE FROM app_plan_shares WHERE id IN (SELECT id FROM app_plan_shares WHERE expires_at <= ? LIMIT 100)').bind(now).run();
      await db.prepare('DELETE FROM app_share_capacity WHERE day < ?').bind(new Date(now - 86400000).toISOString().slice(0, 10)).run();
      await db.prepare('INSERT INTO app_plan_shares(id, ciphertext, revision, expires_at) VALUES (?, ?, 1, ?)').bind(created, body.ciphertext, now + 90 * 86400000).run();
      return reply(201, { id: created, revision: 1 });
    }
    if (!Number.isSafeInteger(body.revision) || Number(body.revision) < 1) return reply(400, { error: 'Invalid revision.' });
    const result = await db.prepare('UPDATE app_plan_shares SET ciphertext = ?, revision = revision + 1 WHERE id = ? AND revision = ? AND expires_at > ?')
      .bind(body.ciphertext, id, body.revision, now).run() as { meta?: { changes?: number } };
    if (result.meta?.changes === 1) return reply(200, { revision: Number(body.revision) + 1 });
    const exists = await db.prepare('SELECT revision FROM app_plan_shares WHERE id = ? AND expires_at > ?').bind(id, now).first();
    return exists ? reply(409, { error: 'Read the latest plan and merge before trying again.' }) : missing();
  } catch {
    // Missing migration or storage failure fails closed, without echoing private payloads.
    return reply(503, { error: 'Sharing is temporarily unavailable.' });
  }
}
