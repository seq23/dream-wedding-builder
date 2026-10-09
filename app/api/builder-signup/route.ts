import { NextRequest, NextResponse } from 'next/server';
import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { normalizeEmail, storeBuilderSignup } from '@/lib/builder-signup';

// Stores the email the free planning builder asks for. Consent must be explicit;
// a missing database is a 503, never a silent success.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  if (body.company) return NextResponse.json({ ok: true });
  const email = normalizeEmail(body.email);
  if (!email) return NextResponse.json({ ok: false, error: 'Enter a valid email address.' }, { status: 400 });
  if (body.consent !== true) return NextResponse.json({ ok: false, error: 'Please tick the box to agree to planning emails.' }, { status: 400 });
  let db: Parameters<typeof storeBuilderSignup>[0] | undefined;
  try { db = (await runtimeEnv()).DB; } catch { db = undefined; }
  if (!db) return NextResponse.json({ ok: false, error: 'Signup storage is unavailable. Please try again shortly.' }, { status: 503 });
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').slice(0, 120);
  await storeBuilderSignup(db, { email, source: String(body.source ?? 'free-wedding-planner').slice(0, 80), host });
  return NextResponse.json({ ok: true });
}
