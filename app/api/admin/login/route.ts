import { NextResponse } from 'next/server';
import { createAdminSession, verifyPassword } from '@/lib/admin-auth';
import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { LIMITS, TOO_MANY, callerKey, isLockedOut, recordEvent, type LimitDB } from '@/lib/abuse-limits';

// Owner login. 10 wrong passwords from one IP in 15 minutes locks that IP out until the window
// passes (lib/abuse-limits.ts); a locked-out IP is refused before the password is even checked.
// Without the database the lockout cannot be counted, so the login fails closed.
export async function POST(req: Request) {
  const origin = req.headers.get('origin'); const host = req.headers.get('host');
  if (origin && host && !origin.includes(host)) return NextResponse.json({ error: 'Origin rejected' }, { status: 403 });
  let db: LimitDB | undefined;
  try { db = (await runtimeEnv()).DB as LimitDB | undefined; } catch { db = undefined; }
  if (!db) return NextResponse.json({ error: 'Sign-in is unavailable right now.' }, { status: 503 });
  const key = await callerKey(req.headers);
  if (await isLockedOut(db, 'admin-login-fail', key, LIMITS.adminLoginFail)) {
    return NextResponse.json({ error: TOO_MANY }, { status: 429, headers: { 'retry-after': String(LIMITS.adminLoginFail.windowS) } });
  }
  const { password } = (await req.json().catch(() => ({}))) as { password?: unknown };
  if (typeof password !== 'string' || !verifyPassword(password)) {
    await recordEvent(db, 'admin-login-fail', key);
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }
  await createAdminSession(); return NextResponse.json({ ok: true });
}
