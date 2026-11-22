import { NextRequest, NextResponse } from 'next/server';
import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { SAMPLE_URL, confirmAddress, verifyConfirm, type NurtureEnv } from '@/lib/nurture';

// The download button in the sample email (lib/nurture.ts, seq0). One click confirms the address
// (double opt-in for the three planning emails, sent only if she also ticked the box) and opens
// the sample. A bad or old link still opens the sample: the PDF is free, only the confirmation is
// skipped. Never the address in the URL: a hash and its signature.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') ?? '';
  const token = req.nextUrl.searchParams.get('t') ?? '';
  let env: NurtureEnv;
  try { env = (await runtimeEnv()) as unknown as NurtureEnv; } catch { env = {}; }
  if (env.DB && env.DOWNLOAD_SIGNING_SECRET && (await verifyConfirm(env.DOWNLOAD_SIGNING_SECRET, id, token))) {
    try { await confirmAddress(env.DB, id); } catch (e) { console.error(JSON.stringify({ event: 'CONFIRM_NOT_RECORDED', message: String(e).slice(0, 160) })); }
  }
  return NextResponse.redirect(SAMPLE_URL, { status: 302, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
