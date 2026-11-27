import { NextRequest, NextResponse } from 'next/server';
import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { LIMITS, TOO_MANY, callerKey, takeSlot, type LimitDB } from '@/lib/abuse-limits';

const required = ['idea_name', 'description', 'category'];
const statuses = ['new', 'reviewing', 'approved', 'rejected', 'duplicate', 'needs_research', 'needs_pricing', 'unsafe', 'spam'];

// The standout-idea form. A honeypot alone let a script fill the review sheet, so each idea
// also takes one slot of the per-IP limit (lib/abuse-limits.ts, security audit 23 Nov 2026).
// The count is per caller, never one shared total, so a stranger cannot use up anyone else's
// tries. When the count cannot be read the idea is refused (503), never forwarded uncounted.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  if (body.company) return NextResponse.json({ ok: true, status: 'received' });
  for (const field of required) {
    if (!String(body[field] || '').trim()) return NextResponse.json({ ok: false, error: `Missing ${field}` }, { status: 400 });
  }
  let underLimit: boolean;
  try {
    const db = (await runtimeEnv()).DB as LimitDB | undefined;
    if (!db) throw new Error('D1 binding DB is unavailable');
    underLimit = await takeSlot(db, 'submit-trend', await callerKey(req.headers), LIMITS.trendSubmit);
  } catch {
    console.error(JSON.stringify({ event: 'TREND_SUBMIT_REFUSED', stop: 'TREND_LIMIT_STORE_UNAVAILABLE' }));
    return NextResponse.json({ ok: false, error: 'Idea submissions are unavailable right now. Please try again shortly.' }, { status: 503 });
  }
  if (!underLimit) return NextResponse.json({ ok: false, error: TOO_MANY }, { status: 429, headers: { 'retry-after': String(LIMITS.trendSubmit.windowS) } });
  const payload = {
    timestamp: new Date().toISOString(),
    submission_id: crypto.randomUUID(),
    idea_name: String(body.idea_name).slice(0, 120),
    description: String(body.description).slice(0, 1000),
    source_type: String(body.source_type || '').slice(0, 80),
    source_url: String(body.source_url || '').slice(0, 500),
    category: String(body.category).slice(0, 80),
    budget_feel: String(body.budget_feel || 'No idea').slice(0, 80),
    why_cool: String(body.why_cool || '').slice(0, 750),
    price_this_out: Boolean(body.price_this_out),
    status: statuses[0]
  };
  const endpoint = process.env.APPS_SCRIPT_TREND_ENDPOINT;
  if (!endpoint) return NextResponse.json({ ok: true, status: 'received_for_review', mode: 'local-contract', payload: { ...payload, source_url: payload.source_url ? '[provided]' : '' } });
  const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...(process.env.APPS_SCRIPT_TREND_SECRET ? { 'x-dwb-secret': process.env.APPS_SCRIPT_TREND_SECRET } : {}) }, body: JSON.stringify(payload) });
  if (!res.ok) return NextResponse.json({ ok: false, error: 'Submission endpoint unavailable' }, { status: 502 });
  return NextResponse.json({ ok: true, status: 'received_for_review' });
}
