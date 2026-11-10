import { NextRequest, NextResponse } from 'next/server';
import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { aiDraftEnabled, centralDay, draftPlan, DESCRIPTION_MAX, type D1Like } from '@/lib/ai-draft';

// The Builder's AI draft step. Limits, kill switch and the $0-only rule live in
// lib/ai-draft.ts; this route only reads the request and the Worker's env.
// Both model keys are Worker secrets read here, on the server; neither reaches the browser.
type AiEnv = { DB?: D1Like; OPENROUTER_API_KEY?: string; GEMINI_API_KEY?: string; AI_DRAFT_ENABLED?: string; AI_DRAFT_SALT?: string; DOWNLOAD_SIGNING_SECRET?: string };

function hostOf(req: NextRequest) { return (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').slice(0, 120); }

async function env(): Promise<AiEnv> { try { return (await runtimeEnv()) as unknown as AiEnv; } catch { return {}; } }

export async function GET(req: NextRequest) {
  const e = await env();
  return NextResponse.json({ enabled: aiDraftEnabled(hostOf(req), e.AI_DRAFT_ENABLED), maxLength: DESCRIPTION_MAX }, { headers: { 'cache-control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > 4000) return NextResponse.json({ ok: false, code: 'TOO_LARGE', error: 'That request is too large.' }, { status: 413 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, code: 'BAD_JSON', error: 'Invalid request.' }, { status: 400 });
  const e = await env();
  const result = await draftPlan({
    db: e.DB,
    apiKey: e.OPENROUTER_API_KEY,
    geminiKey: e.GEMINI_API_KEY,
    consent: body.consent === true,
    enabled: aiDraftEnabled(hostOf(req), e.AI_DRAFT_ENABLED),
    email: body.email,
    description: body.description,
    ip: req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? '',
    today: centralDay(),
    salt: e.AI_DRAFT_SALT || e.DOWNLOAD_SIGNING_SECRET || ''
  });
  return NextResponse.json(result.body, { status: result.status, headers: { 'cache-control': 'no-store' } });
}
