import { describe, expect, it } from 'vitest';
import { alertOwnerIfFailed } from '@/lib/delivery-alert';
import type { RetryRun } from '@/lib/delivery-retry';

// 16 Oct 2026: delivery failures were only visible to someone who looked. A failed
// retry run must now email the owner; a clean run must not.
const run = (over: Partial<RetryRun>): RetryRun => ({ examined: 1, attempted: 1, sent: 0, failed: 0, exhausted: 0, waiting: 0, results: [], ...over });
function recorder(status = 200) {
  const sent: any[] = [];
  const f = (async (_u: string, init: any) => { sent.push(JSON.parse(init.body)); return new Response('{}', { status }); }) as unknown as typeof fetch;
  return { sent, f };
}
const env = { RESEND_API_KEY: 're_test', OWNER_ALERT_EMAIL: 'owner@example.test' };

describe('owner alert on failed delivery', () => {
  it('sends nothing for a clean run', async () => {
    const { sent, f } = recorder();
    expect((await alertOwnerIfFailed(env, run({ sent: 1 }), null, f)).status).toBe('NOT_NEEDED');
    expect(sent).toHaveLength(0);
  });
  it('emails the owner when an attempt failed, naming the order and never the buyer address', async () => {
    const { sent, f } = recorder();
    const r = run({ failed: 1, results: [{ order_id: 'ord_1', outcome: 'FAILED', message_id: null, error: 'domain is not verified' }] });
    expect((await alertOwnerIfFailed(env, r, null, f)).status).toBe('SENT');
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual(['owner@example.test']);
    expect(sent[0].text).toContain('ord_1');
    expect(sent[0].text).toContain('domain is not verified');
    expect(sent[0].text).not.toMatch(/@(?!example)/);
  });
  it('emails the owner when the run itself threw', async () => {
    const { sent, f } = recorder();
    expect((await alertOwnerIfFailed(env, null, 'D1 binding DB is unavailable', f)).status).toBe('SENT');
    expect(sent[0].subject).toContain('crashed');
  });
  it('reports FAILED, not silence, when the alert itself cannot send', async () => {
    const { f } = recorder(422);
    expect((await alertOwnerIfFailed(env, run({ failed: 1 }), null, f)).status).toBe('FAILED');
    expect((await alertOwnerIfFailed({}, run({ failed: 1 }), null, f)).status).toBe('FAILED');
  });
});
