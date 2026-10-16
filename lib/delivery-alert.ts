// Pushes a failed delivery to a person instead of waiting to be looked at.
//
// Found 16 Oct 2026, before Pinterest traffic: the hourly retry (delivery-retry.ts)
// works, but its only failure signals were a 503 on /api/health/delivery, the
// /admin red panel and a log line, and nothing polls any of them. The July order
// sat undelivered for three months that way. After every cron run with a FAILED or
// NOT_SENDABLE attempt (or a run that threw), one email goes to the owner. It is
// bounded without extra state: each order has at most MAX_RETRIES retry attempts,
// so at most that many alerts per order. Buyer addresses never appear in it.

import { DEFAULT_FROM, DEFAULT_REPLY_TO, type DeliveryEnv } from './delivery-email';
import type { RetryRun } from './delivery-retry';

export type AlertEnv = DeliveryEnv & { OWNER_ALERT_EMAIL?: string; APP_BASE_URL?: string };
export type AlertOutcome = { status: 'NOT_NEEDED' | 'SENT' | 'FAILED'; error: string | null };

export function alertBody(run: RetryRun | null, runError: string | null, base: string) {
  const lines = runError
    ? [`The hourly delivery retry did not run: ${runError}`]
    : [
        `Hourly delivery retry: ${run!.failed} attempt(s) failed, ${run!.sent} sent, ${run!.exhausted} order(s) out of retries.`,
        ...run!.results.filter((r) => r.outcome === 'FAILED' || r.outcome === 'NOT_SENDABLE').map((r) => `- order ${r.order_id}: ${r.outcome} — ${r.error ?? 'no error text'}`)
      ];
  lines.push('', `Paid buyers are waiting on their download. Open ${base}/admin and use "Resend delivery email" once the cause is fixed.`, `Status: ${base}/api/health/delivery`);
  return lines.join('\n');
}

export async function alertOwnerIfFailed(env: AlertEnv, run: RetryRun | null, runError: string | null, fetchImpl: typeof fetch = fetch): Promise<AlertOutcome> {
  if (!runError && (!run || run.failed === 0)) return { status: 'NOT_NEEDED', error: null };
  const base = (env.APP_BASE_URL || 'https://weddingchecklistpdf.com').replace(/\/$/, '');
  const fail = (error: string): AlertOutcome => {
    console.error(JSON.stringify({ event: 'DELIVERY_ALERT_FAILED', error }));
    return { status: 'FAILED', error };
  };
  if (!env.RESEND_API_KEY) return fail('RESEND_API_KEY is not configured');
  try {
    const response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.APP_FROM_EMAIL || DEFAULT_FROM,
        to: [env.OWNER_ALERT_EMAIL || DEFAULT_REPLY_TO],
        subject: runError ? 'Wedding Checklist PDF: delivery retry crashed' : `Wedding Checklist PDF: ${run!.failed} buyer delivery email(s) failed`,
        text: alertBody(run, runError, base)
      })
    });
    if (!response.ok) return fail(`Resend HTTP ${response.status}`);
    console.log(JSON.stringify({ event: 'DELIVERY_ALERT_SENT', failed: run?.failed ?? null, run_error: runError }));
    return { status: 'SENT', error: null };
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}
