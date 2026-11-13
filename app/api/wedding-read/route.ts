import { NextRequest, NextResponse } from 'next/server';
import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { aiDraftEnabled, centralDay, type D1Like } from '@/lib/ai-draft';
import { BODY_MAX_BYTES, weddingRead } from '@/lib/wedding-read';

// Step 2 of the free journey. Limits, checks and the $0-only rule live in
// lib/wedding-read.ts; this route only reads the request and the Worker's env.
// Over any limit, off, or with no model free, the answer is the fixed-list one:
// she never sees an error page for asking.
type Env = { DB?: D1Like; OPENROUTER_API_KEY?: string; GEMINI_API_KEY?: string; AI_DRAFT_ENABLED?: string; AI_DRAFT_SALT?: string; DOWNLOAD_SIGNING_SECRET?: string };

const hostOf = (req: NextRequest) => (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').slice(0, 120);
async function env(): Promise<Env> { try { return (await runtimeEnv()) as unknown as Env; } catch { return {}; } }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'cache-control': 'no-store' } });

export async function POST(req: NextRequest) {
  if (Number(req.headers.get('content-length') ?? 0) > BODY_MAX_BYTES) return json({ ok: false, code: 'TOO_LARGE', error: 'Those photos are too large. Try one fewer.' }, 413);
  const raw = await req.text().catch(() => '');
  if (raw.length > BODY_MAX_BYTES) return json({ ok: false, code: 'TOO_LARGE', error: 'Those photos are too large. Try one fewer.' }, 413);
  let body: unknown = null;
  try { body = JSON.parse(raw); } catch { return json({ ok: false, code: 'BAD_JSON', error: 'Invalid request.' }, 400); }
  const e = await env();
  const result = await weddingRead({
    db: e.DB,
    apiKey: e.OPENROUTER_API_KEY,
    geminiKey: e.GEMINI_API_KEY,
    enabled: aiDraftEnabled(hostOf(req), e.AI_DRAFT_ENABLED),
    body,
    ip: req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? '',
    today: centralDay(),
    salt: e.AI_DRAFT_SALT || e.DOWNLOAD_SIGNING_SECRET || ''
  });
  return json(result.body, result.status);
}
