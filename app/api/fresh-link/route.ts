import { NextRequest, NextResponse } from 'next/server';
import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { safeEmail } from '@/lib/fulfillment';
import { FRESH_LINK_ANSWER, sendFreshLinks, type FreshLinkEnv } from '@/lib/fresh-link';
import { LIMITS, TOO_MANY, callerKey, emailKey, takeSlot, type LimitDB } from '@/lib/abuse-limits';

export const dynamic = 'force-dynamic';

const PRIVATE = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' };
const answer = () => NextResponse.json({ ok: true, message: FRESH_LINK_ANSWER }, { headers: PRIVATE });

// "Email me a fresh link" (components/FreshLinkForm.tsx). The rules are in lib/fresh-link.ts.
// Every well-formed ask gets the same answer, so nobody learns who is a customer.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (body?.company) return answer(); // honeypot
  const email = safeEmail(typeof body?.email === 'string' ? body.email : '');
  if (!email || email.length > 254) return NextResponse.json({ ok: false, error: 'Type the email you bought with, like name@example.com.' }, { status: 400, headers: PRIVATE });
  let env: FreshLinkEnv;
  try { env = (await runtimeEnv()) as FreshLinkEnv; } catch { env = {}; }
  const secret = process.env.DOWNLOAD_SIGNING_SECRET || env.DOWNLOAD_SIGNING_SECRET;
  if (!env.DB || !secret) {
    console.error(JSON.stringify({ event: 'NAMED_STOP', stop: 'FRESH_LINK_UNAVAILABLE', reason: !env.DB ? 'D1 binding DB is unavailable' : 'DOWNLOAD_SIGNING_SECRET is not configured' }));
    return NextResponse.json({ ok: false, error: 'We could not send your link just now. Please try again in a few minutes, or write to info@weddingchecklistpdf.com.' }, { status: 503, headers: PRIVATE });
  }
  const db = env.DB as unknown as LimitDB;
  if (!(await takeSlot(db, 'freshLink', await callerKey(req.headers), LIMITS.freshLink))) {
    return NextResponse.json({ ok: false, error: TOO_MANY }, { status: 429, headers: { ...PRIVATE, 'retry-after': String(LIMITS.freshLink.windowS) } });
  }
  // Over the per-address limit the answer stays the same and nothing is sent.
  if (!(await takeSlot(db, 'freshLinkEmail', await emailKey(email), LIMITS.freshLinkEmail))) return answer();
  try {
    const { sent, failed } = await sendFreshLinks({ ...env, DOWNLOAD_SIGNING_SECRET: secret, APP_BASE_URL: process.env.APP_BASE_URL || env.APP_BASE_URL }, email);
    // Counts only: no address, so the log does not say who asked.
    if (sent || failed) console.log(JSON.stringify({ event: 'FRESH_LINK', sent, failed }));
  } catch (error) {
    console.error(JSON.stringify({ event: 'FRESH_LINK_FAILED', error: error instanceof Error ? error.message : String(error) }));
  }
  return answer();
}
