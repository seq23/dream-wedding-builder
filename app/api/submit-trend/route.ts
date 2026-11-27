import { NextRequest, NextResponse } from 'next/server';
import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { LIMITS, TOO_MANY, callerKey, takeSlot, type LimitDB } from '@/lib/abuse-limits';
import { IDEA_BODY_MAX_BYTES, IDEA_NOT_SAVED, cleanIdea, ideaIpHash, saveIdea, type IdeasDB } from '@/lib/trend-ideas';

// The standout-idea form on the weddingchecklistpdf.com homepage. Each idea is one row in the
// site's own D1 (lib/trend-ideas.ts), read on the owner-signed-in /admin page; the visitor is
// told it was received only after that row is written. It replaced an Apps Script forward that
// was never configured, so for months the form said "received" and kept nothing (27 Nov 2026).
// A honeypot alone let a script fill the store, so each idea also takes one slot of the per-IP
// limit (lib/abuse-limits.ts, security audit 23 Nov 2026). When the count cannot be read the idea
// is refused (503), never stored uncounted.
const NOT_SAVED = IDEA_NOT_SAVED;

export async function POST(req: NextRequest) {
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > IDEA_BODY_MAX_BYTES) return NextResponse.json({ ok: false, error: 'That idea is too long.' }, { status: 413 });
  const raw = await req.text().catch(() => '');
  if (new TextEncoder().encode(raw).length > IDEA_BODY_MAX_BYTES) return NextResponse.json({ ok: false, error: 'That idea is too long.' }, { status: 413 });
  let body: Record<string, unknown> | null = null;
  try { const parsed = JSON.parse(raw); body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null; } catch { body = null; }
  if (!body) return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  if (body.company) return NextResponse.json({ ok: true, status: 'received' });
  const cleaned = cleanIdea(body);
  if ('missing' in cleaned) return NextResponse.json({ ok: false, error: `Missing ${cleaned.missing}` }, { status: 400 });

  let db: (LimitDB & IdeasDB) | undefined;
  let salt = '';
  let underLimit: boolean;
  try {
    const env = (await runtimeEnv()) as { DB?: LimitDB & IdeasDB; AI_DRAFT_SALT?: string; DOWNLOAD_SIGNING_SECRET?: string };
    db = env.DB;
    salt = env.AI_DRAFT_SALT || env.DOWNLOAD_SIGNING_SECRET || '';
    if (!db) throw new Error('D1 binding DB is unavailable');
    underLimit = await takeSlot(db, 'submit-trend', await callerKey(req.headers), LIMITS.trendSubmit);
  } catch {
    console.error(JSON.stringify({ event: 'TREND_SUBMIT_REFUSED', stop: 'TREND_LIMIT_STORE_UNAVAILABLE' }));
    return NextResponse.json({ ok: false, error: NOT_SAVED }, { status: 503 });
  }
  if (!underLimit) return NextResponse.json({ ok: false, error: TOO_MANY }, { status: 429, headers: { 'retry-after': String(LIMITS.trendSubmit.windowS) } });

  try {
    await saveIdea(db, cleaned.idea, await ideaIpHash(req.headers, salt));
  } catch (err) {
    console.error(JSON.stringify({ event: 'TREND_SUBMIT_REFUSED', stop: 'TREND_IDEA_NOT_SAVED', detail: String((err as Error)?.message || err).slice(0, 200) }));
    return NextResponse.json({ ok: false, error: NOT_SAVED }, { status: 503 });
  }
  return NextResponse.json({ ok: true, status: 'received_for_review' });
}
