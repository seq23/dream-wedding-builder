import { NextRequest, NextResponse } from 'next/server';
import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { centralDay, type D1Like } from '@/lib/ai-draft';
import { recordReach } from '@/lib/journey-reach';

// Counts that a bride who began at step 1 reached her dated plan (lib/journey-reach.ts).
// Always answers ok: counting must never get in her way.
type Env = { DB?: D1Like; AI_DRAFT_SALT?: string; DOWNLOAD_SIGNING_SECRET?: string };

export async function POST(req: NextRequest) {
  if (Number(req.headers.get('content-length') ?? 0) > 200) return NextResponse.json({ ok: true });
  const body = (await req.json().catch(() => null)) as { via?: unknown } | null;
  let e: Env = {};
  try { e = (await runtimeEnv()) as unknown as Env; } catch { /* counted as not counted */ }
  await recordReach({ db: e.DB, via: body?.via, ip: req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? '', today: centralDay(), salt: e.AI_DRAFT_SALT || e.DOWNLOAD_SIGNING_SECRET || '', isTest: req.headers.get('x-dw-test') === '1' }).catch(err => console.error(`NAMED STOP [JOURNEY_REACH_NOT_COUNTED] ${String((err as Error)?.message || err).slice(0, 200)}`));
  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}
