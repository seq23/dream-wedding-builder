// The Play review code on the phone (src/billing/review.ts, checkout 'review', the full-plan screen): how it breaks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REVIEW_BUTTON, REVIEW_LINK, REVIEW_URL, redeemReviewCode, reviewCodeAllowed, reviewWindowOpen } from '../src/billing/review';
import { checkout } from '../src/billing/checkout';
import { eventStore } from '../src/billing/eventStore';
import { DisabledPurchases, type PurchasesProvider } from '../src/billing/provider';

const CODE = '4815162342', ID = `$RCAnonymousID:${'a'.repeat(32)}`;
const answer = (status: number, body: object) => (async () => Response.json(body, { status })) as unknown as typeof fetch;

test('no network, a closed window or any odd answer hides the link or says "try again"; never "paid"', async () => {
  const offline = (async () => { throw Error('offline'); }) as unknown as typeof fetch;
  assert.equal(await reviewWindowOpen(offline), false);
  assert.equal(await reviewWindowOpen(answer(404, { error: 'NOT_FOUND' })), false);
  assert.equal(await reviewWindowOpen(answer(200, { open: true })), true);
  assert.equal(await redeemReviewCode(CODE, ID, offline), 'tryAgain');
  assert.equal(await redeemReviewCode(CODE, ID, answer(503, { error: 'TRY_AGAIN' })), 'tryAgain');
  assert.equal(await redeemReviewCode(CODE, ID, answer(200, { maybe: true })), 'tryAgain');
  assert.equal(await redeemReviewCode(CODE, ID, answer(403, { error: 'USED_UP' })), 'usedUp');
  assert.equal(await redeemReviewCode(CODE, ID, answer(403, { error: 'WRONG_CODE' })), 'wrong');
  assert.equal(await redeemReviewCode(CODE, ID, answer(429, { error: 'SLOW_DOWN' })), 'slow');
  assert.equal(await redeemReviewCode(CODE, ID, answer(200, { unlocked: true })), 'unlocked');
});

test('only the code and the anonymous purchase ID leave the phone, and only for a 10-digit code and an anonymous ID', async () => {
  const seen: { url: string; body: string }[] = [];
  const spy = (async (url: string, init?: RequestInit) => { seen.push({ url, body: String(init?.body ?? '') }); return Response.json({ unlocked: true }); }) as unknown as typeof fetch;
  assert.equal(await redeemReviewCode('12345', ID, spy), 'wrong');
  assert.equal(await redeemReviewCode(CODE, null, spy), 'tryAgain');
  assert.equal(await redeemReviewCode(CODE, 'her@email.com', spy), 'tryAgain');
  assert.equal(seen.length, 0);
  await redeemReviewCode(CODE, ID, spy);
  assert.equal(seen[0].url, `${REVIEW_URL}/unlock`);
  assert.deepEqual(Object.keys(JSON.parse(seen[0].body)), ['code', 'app_user_id']);
});

test('Android only, store open, unpaid, never on the new-event screen: iOS never shows the link', () => {
  assert.equal(reviewCodeAllowed('android', true, false, false), true);
  const closed: [string, boolean, boolean, boolean][] = [['ios', true, false, false], ['web', true, false, false], ['android', false, false, false], ['android', true, true, false], ['android', true, false, true]];
  for (const [os, store, paid, newEvent] of closed) assert.equal(reviewCodeAllowed(os, store, paid, newEvent), false, os);
  const screen = readFileSync('app/(tabs)/more/full-plan.tsx', 'utf8');
  assert.match(screen, /if \(reviewCodeAllowed\(Platform\.OS, purchases\.available, draft\.locked, newEvent\)\) void reviewWindowOpen\(\)/);
  assert.match(screen, /\{reviewWindow && !locked \?/);
});

test('after an accepted code the phone verifies like Restore without restoring a receipt; a refused door unlocks nothing', async () => {
  const setup = (door: 'ok' | 'refused') => {
    const data = new Map<string, string>(), calls: string[] = [];
    const storage = { async getItem(k: string) { return data.get(k) ?? null; }, async setItem(k: string, v: string) { data.set(k, v); } };
    const provider: PurchasesProvider = { available: true, async products() { return []; }, async purchase() { throw Error('no sale'); },
      async restore() { calls.push('restore'); return { userId: ID, active: [] }; }, async appUserId() { return ID; },
      async refresh() { calls.push('refresh'); return { userId: ID, active: ['full_plan'] }; } };
    const downloads = { async refresh(id: string) { calls.push(`door ${id === ID}`); if (door === 'refused') throw Error('Purchase could not be confirmed.'); return { list: { windows: [], tasks: [] }, packs: [], newEvents: ['b'.repeat(64)] }; } };
    return { data, calls, storage, provider, downloads };
  };
  const ok = setup('ok');
  await checkout(ok.storage, ok.provider, ok.downloads, () => 'event-1').review('Our wedding', '');
  assert.deepEqual(ok.calls, ['refresh', 'door true']);
  assert.equal((await eventStore(ok.storage).active())?.fullPlan, true);
  assert.deepEqual((await eventStore(ok.storage).read()).paidNewEvents, ['b'.repeat(64)]);
  // The SDK saying "full_plan" is not enough: the door refused, so nothing is recorded.
  const no = setup('refused');
  await assert.rejects(checkout(no.storage, no.provider, no.downloads, () => 'event-1').review('Our wedding', ''));
  assert.equal(no.data.size === 0 || !(await eventStore(no.storage).read()).events.some(e => e.fullPlan), true);
  await assert.rejects(new DisabledPurchases().appUserId());
});

test('the Play reviewer note fits 500 characters and names the real screens', () => {
  const note = readFileSync('store/play-console-answers.md', 'utf8').split('## App access')[1]!.match(/^> (.+)$/m)![1]!;
  assert.ok([...note].length <= 500, `${[...note].length} characters`);
  assert.ok(note.includes(REVIEW_LINK) && note.includes(REVIEW_BUTTON), 'link and button names');
  assert.match(readFileSync('app/(tabs)/more/index.tsx', 'utf8'), /label="See the full plan ›"/);
  assert.match(readFileSync('app/(tabs)/more/index.tsx', 'utf8'), /label="Start a new event ›"/);
  assert.ok(note.includes('See the full plan') && note.includes('Start a new event') && note.includes('I don’t know yet'));
  assert.doesNotMatch(note, /\d{10}/);
});
