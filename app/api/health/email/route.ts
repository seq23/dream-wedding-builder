import { NextResponse } from 'next/server';
import { runtimeEnv } from '@/lib/cloudflare-runtime';
import { NURTURE_RUNS_DDL, signupCounts, type NurtureDB } from '@/lib/nurture';
import { judge } from '@/lib/email-health';

export const dynamic = 'force-dynamic';

// Health check for marketing email (rule 0, 7 Nov 2026: every send could fail while every run
// looked fine). 503 when the last nurture run was a named stop, or when no run has been
// recorded in 3 hours (the cron is hourly). Read by .github/workflows/email-health.yml, which
// goes red. Public, so it returns counts and the stop line, never an address.
export async function GET() {
  const env = await runtimeEnv();
  if (!env.DB) return NextResponse.json({ status: 'NAMED STOP [NO_DB] D1 binding DB is unavailable' }, { status: 503 });
  await env.DB.prepare(NURTURE_RUNS_DDL).run();
  const last = await env.DB.prepare('SELECT ran_at, sent, failed, stop FROM nurture_runs ORDER BY ran_at DESC LIMIT 1').first() as { ran_at: string; sent: number; failed: number; stop: string | null } | null;
  const verdict = judge(last);
  // Sign-up counts for the Boss OS scorecard (growth plan floors: 25 by day 30, 100 by day 60). Counts only.
  const signups = await signupCounts(env.DB as unknown as NurtureDB).catch(() => null);
  return NextResponse.json({ status: verdict.status, last_run: last ? { ran_at: last.ran_at, sent: last.sent, failed: last.failed } : null, signups }, { status: verdict.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
