import { NextRequest, NextResponse } from 'next/server';
import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { optOut, verifyUnsubscribe, type NurtureEnv } from '@/lib/nurture';

// One-click unsubscribe. GET (the link in every email) and POST (List-Unsubscribe-Post,
// RFC 8058) both opt the address out at once; no login, no confirmation step.
async function handle(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') ?? '';
  const token = req.nextUrl.searchParams.get('t') ?? '';
  let env: NurtureEnv;
  try { env = (await runtimeEnv()) as unknown as NurtureEnv; } catch { env = {}; }
  if (!env.DB || !env.DOWNLOAD_SIGNING_SECRET) return new NextResponse('Unsubscribe is unavailable right now. Reply to any email and we will remove you by hand.', { status: 503 });
  if (!(await verifyUnsubscribe(env.DOWNLOAD_SIGNING_SECRET, id, token))) return new NextResponse('This unsubscribe link is not valid. Reply to any email and we will remove you by hand.', { status: 400 });
  await optOut(env.DB, id);
  return new NextResponse('<!doctype html><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width"><title>Unsubscribed</title><p style="font-family:Arial,sans-serif;max-width:520px;margin:60px auto;font-size:18px">You are unsubscribed. Dream Wedding will not email you again.</p>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
export const GET = handle;
export const POST = handle;
