// Worker entry point. OpenNext's generated worker serves every request; this file
// adds the cron trigger (wrangler.jsonc "triggers") that retries undelivered
// paid-order emails. See lib/delivery-retry.ts and docs/PAID_ORDER_FULFILLMENT_RUNBOOK.md.
// .open-next/worker.js exists only after `opennextjs-cloudflare build`.
// @ts-ignore -- generated at build time
import handler from './.open-next/worker.js';
import { runDeliveryRetry, type RetryEnv } from './lib/delivery-retry';
import { recordPinterestVisit } from './lib/pinterest-visits';
import { alertOwnerIfFailed, type AlertEnv } from './lib/delivery-alert';
import { runNurture, type NurtureEnv } from './lib/nurture';
import { purgeExpiredShares } from './lib/plan-share';
import { serveWithEdgeCache } from './lib/edge-cache';

export default {
  // Pinterest-referred page views (utm_source=pinterest) are counted per pin variant
  // in D1 off the response path (lib/pinterest-visits.ts).
  fetch(request: Request, env: RetryEnv, ctx: { waitUntil(p: Promise<unknown>): void }) {
    if (request.url.includes('utm_source=')) ctx.waitUntil(recordPinterestVisit(env.DB as never, request));
    // Public pages are answered from Cloudflare's cache when a copy exists (lib/edge-cache.ts).
    // The deploy's version id is part of the key, so a new deploy starts with fresh pages.
    const version = (env as { CF_VERSION_METADATA?: { id?: string } }).CF_VERSION_METADATA?.id ?? '';
    const cache = version ? (globalThis as unknown as { caches?: { default?: Parameters<typeof serveWithEdgeCache>[2] } }).caches?.default : undefined;
    // A shared copy in R2 answers data centres that have no copy yet, without starting Next.
    const shared = (env as { NEXT_INC_CACHE_R2_BUCKET?: Parameters<typeof serveWithEdgeCache>[5] }).NEXT_INC_CACHE_R2_BUCKET;
    return serveWithEdgeCache(request, version, cache, ctx, () => handler.fetch(request, env, ctx), shared);
  },
  async scheduled(_controller: unknown, env: RetryEnv & AlertEnv, ctx: { waitUntil(p: Promise<unknown>): void }) {
    ctx.waitUntil(purgeExpiredShares(env.DB).then(
      run => console.log(JSON.stringify({ event: 'APP_SHARE_PURGE', ...run })),
      () => console.error(JSON.stringify({ event: 'APP_SHARE_PURGE_FAILED', stop: 'NAMED STOP [APP_SHARE_RETENTION_FAILED]' }))
    ));
    // Free-sample follow-ups, the one planner welcome and the one review ask (lib/nurture.ts); due emails only.
    ctx.waitUntil(runNurture(env as unknown as NurtureEnv).then(
      (run) => console.log(JSON.stringify({ event: 'NURTURE_RUN', ...run })),
      (error) => console.error(JSON.stringify({ event: 'NURTURE_RUN_FAILED', error: error instanceof Error ? error.message : String(error) }))
    ));
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
