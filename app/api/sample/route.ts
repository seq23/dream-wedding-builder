import { NextRequest, NextResponse } from 'next/server';
import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { normalizeEmail, storeBuilderSignup } from '@/lib/builder-signup';
import { SAMPLE_SOURCE, sendSample, type NurtureEnv } from '@/lib/nurture';
import { LIMITS, TOO_MANY, callerKey, takeSlot, type LimitDB } from '@/lib/abuse-limits';

// The free checklist sample (components/SampleSignup.tsx). The visitor types their own
// address and ticks consent; the address is stored like every other sign-up and the
// sample goes out at once. The follow-up emails come from the hourly cron (lib/nurture.ts).
// Anyone can type any address, so: 3 tries an hour per IP (lib/abuse-limits.ts), and the
// daily send ceiling in lib/nurture.ts; over the ceiling the sign-up is kept and sent later.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  if (body.company) return NextResponse.json({ ok: true }); // honeypot
  const email = normalizeEmail(body.email);
  if (!email) return NextResponse.json({ ok: false, error: 'Enter a valid email address.' }, { status: 400 });
  if (body.consent !== true) return NextResponse.json({ ok: false, error: 'Please tick the box so we can email the sample.' }, { status: 400 });
  let env: NurtureEnv;
  try { env = (await runtimeEnv()) as unknown as NurtureEnv; } catch { env = {}; }
  if (!env.DB) return NextResponse.json({ ok: false, error: 'Sign-up is unavailable right now. Please try again shortly.' }, { status: 503 });
  if (!(await takeSlot(env.DB as unknown as LimitDB, 'sample', await callerKey(req.headers), LIMITS.sample))) {
    return NextResponse.json({ ok: false, error: TOO_MANY }, { status: 429, headers: { 'retry-after': String(LIMITS.sample.windowS) } });
  }
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').slice(0, 120);
  await storeBuilderSignup(env.DB as never, { email, source: SAMPLE_SOURCE, host });
  const sent = await sendSample(env, email);
  if (sent.status === 'STOPPED') console.error(JSON.stringify({ event: 'SAMPLE_NOT_SENT', stop: sent.stop }));
  // The PDF link is shown on the page as well, so the visitor is never left waiting on email.
  return NextResponse.json({ ok: true, emailed: sent.status === 'SENT' || sent.status === 'ALREADY' });
}
