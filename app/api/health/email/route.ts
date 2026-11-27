import { NextResponse } from 'next/server';
import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { requireAdmin } from '@/lib/admin-auth';
import { signupCounts, type NurtureDB } from '@/lib/nurture';
import { judge } from '@/lib/email-health';

export const dynamic = 'force-dynamic';

type LastRun = { ran_at: string; sent: number; failed: number; stop: string | null };
const answer = (ok: boolean, detail: Record<string, unknown> = {}) =>
  NextResponse.json({ status: ok ? 'OK' : 'FAIL', ...detail }, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });

// Health check for marketing email (rule 0, 7 Nov 2026: every send could fail while every run
// looked fine). 503 when the last nurture run was a named stop, when no run has been recorded
// in 3 hours (the cron is hourly), or when the run record cannot be read. Read by
// .github/workflows/email-health.yml, which goes red on anything but 200.
//
// Security audit 23 Nov 2026: a stranger gets OK or FAIL and nothing else, and the request only
// reads (it used to hand anyone the sign-up totals and send counts and run CREATE TABLE on every
// GET). The stop line, the last run and the sign-up counts are shown only to the signed-in owner
// (the /admin session, lib/admin-auth.ts).
export async function GET() {
  const owner = await requireAdmin().catch(() => false);
  let last: LastRun | null;
  let db: NurtureDB;
  try {
    const env = await runtimeEnv();
    if (!env.DB) return answer(false, owner ? { reason: 'NAMED STOP [NO_DB] D1 binding DB is unavailable' } : {});
    db = env.DB as unknown as NurtureDB;
    last = await env.DB.prepare('SELECT ran_at, sent, failed, stop FROM nurture_runs ORDER BY ran_at DESC LIMIT 1').first() as LastRun | null;
  } catch {
    return answer(false, owner ? { reason: 'NAMED STOP [NURTURE_RUNS_UNREADABLE] the nurture run record could not be read' } : {});
  }
  const verdict = judge(last);
  if (!owner) return answer(verdict.ok);
  const signups = await signupCounts(db).catch(() => null);
  return answer(verdict.ok, { reason: verdict.status, last_run: last ? { ran_at: last.ran_at, sent: last.sent, failed: last.failed } : null, signups });
}
