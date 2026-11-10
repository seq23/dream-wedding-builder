import { NextRequest, NextResponse } from 'next/server';
import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { normalizeEmail, storeBuilderSignup } from '@/lib/builder-signup';
import { SAMPLE_SOURCE, sendFailureStop, sendSample, type NurtureEnv } from '@/lib/nurture';
import { verifyTurnstile } from '@/lib/turnstile';
import { LIMITS, TOO_MANY, callerKey, takeSlot, type LimitDB } from '@/lib/abuse-limits';

// The free checklist sample (components/SampleSignup.tsx). The visitor types their own
// address and ticks consent; the address is stored like every other sign-up and the
// sample goes out at once. The follow-up emails come from the hourly cron (lib/nurture.ts).
// Anyone can type any address, so: 3 tries an hour per IP (lib/abuse-limits.ts), and the
// daily send ceiling in lib/nurture.ts; over the ceiling the sign-up is kept and sent later.
// A Turnstile check (lib/turnstile.ts) comes first; without its secret the form fails closed.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  if (body.company) return NextResponse.json({ ok: true }); // honeypot
  const email = normalizeEmail(body.email);
  if (!email) return NextResponse.json({ ok: false, error: 'Enter a valid email address.' }, { status: 400 });
  if (body.consent !== true) return NextResponse.json({ ok: false, error: 'Please tick the box so we can email the sample.' }, { status: 400 });
  let env: NurtureEnv & { TURNSTILE_SECRET_KEY?: string };
  try { env = (await runtimeEnv()) as unknown as NurtureEnv & { TURNSTILE_SECRET_KEY?: string }; } catch { env = {}; }
  if (!env.DB) return NextResponse.json({ ok: false, error: 'Sign-up is unavailable right now. Please try again shortly.' }, { status: 503 });
  const check = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, body.turnstileToken, req.headers.get('cf-connecting-ip'));
  if (check === 'NO_SECRET') {
    console.error(JSON.stringify({ event: 'SAMPLE_NOT_SENT', stop: 'NAMED STOP [NO_TURNSTILE_SECRET] TURNSTILE_SECRET_KEY is not set on the Worker' }));
    return NextResponse.json({ ok: false, error: 'The sample form is unavailable right now. Please try again shortly.' }, { status: 503 });
  }
  if (check !== 'PASS') return NextResponse.json({ ok: false, error: 'Please complete the check above the button, then try again.' }, { status: 400 });
  if (!(await takeSlot(env.DB as unknown as LimitDB, 'sample', await callerKey(req.headers), LIMITS.sample))) {
    return NextResponse.json({ ok: false, error: TOO_MANY }, { status: 429, headers: { 'retry-after': String(LIMITS.sample.windowS) } });
  }
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').slice(0, 120);
  await storeBuilderSignup(env.DB as never, { email, source: SAMPLE_SOURCE, host });
  const sent = await sendSample(env, email);
  const emailed = sent.status === 'SENT' || sent.status === 'ALREADY';
  // Not emailed is said, never hidden (rule 0, 7 Nov 2026): the page says so plainly and keeps the PDF link.
  const stop = emailed || sent.status === 'OPTED_OUT' ? null : ('stop' in sent && sent.stop ? sent.stop : sendFailureStop(1));
  if (stop) console.error(JSON.stringify({ event: 'SAMPLE_NOT_SENT', stop }));
  return NextResponse.json({ ok: true, emailed, ...(stop ? { stop } : {}) });
}
