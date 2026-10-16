// Worker entry point. OpenNext's generated worker serves every request; this file
// adds the cron trigger (wrangler.jsonc "triggers") that retries undelivered
// paid-order emails. See lib/delivery-retry.ts and docs/PAID_ORDER_FULFILLMENT_RUNBOOK.md.
// .open-next/worker.js exists only after `opennextjs-cloudflare build`.
// @ts-ignore -- generated at build time
import handler from './.open-next/worker.js';
import { runDeliveryRetry, type RetryEnv } from './lib/delivery-retry';
import { alertOwnerIfFailed, type AlertEnv } from './lib/delivery-alert';

export default {
  fetch: handler.fetch,
  async scheduled(_controller: unknown, env: RetryEnv & AlertEnv, ctx: { waitUntil(p: Promise<unknown>): void }) {
    ctx.waitUntil(
      runDeliveryRetry(env).then(
        (run) => {
          console.log(JSON.stringify({ event: 'DELIVERY_RETRY_RUN', ...run, results: run.results.map((r) => ({ order_id: r.order_id, outcome: r.outcome, message_id: r.message_id })) }));
          return alertOwnerIfFailed(env, run, null);
        },
        (error) => {
          const message = error instanceof Error ? error.message : String(error);
          console.error(JSON.stringify({ event: 'DELIVERY_RETRY_RUN_FAILED', error: message }));
          return alertOwnerIfFailed(env, null, message);
        }
      )
    );
  }
};
