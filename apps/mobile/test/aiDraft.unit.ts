import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiDraftClient } from '../src/aiDraft';
const input = { description: 'A small wedding next summer', consent: true };
function harness(replies: { ok: boolean; [key: string]: unknown }[]) {
  const saved = new Map<string, string>();
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const storage = { async getItem(k: string) { return saved.get(k) ?? null; }, async setItem(k: string, v: string) { saved.set(k, v); } };
  const client = aiDraftClient(storage, async (url, init) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    const reply = replies.shift();
    if (!reply) throw new Error('offline');
    return { ok: reply.ok, async json() { return reply; } };
  });
  return { client, calls, storage };
}
test('no consent sends nothing', async () => {
  const h = harness([]);
  assert.equal((await h.client.request({ ...input, consent: false })).ok, false);
  assert.deepEqual(h.calls, []);
});
test('finding 5: the draft asks for no email: one call, no signup, no email in the body', async () => {
  const draft = { weddingDate: '2027-06-12' };
  const h = harness([{ ok: true, draft, note: 'Check each field.' }]);
  assert.deepEqual(await h.client.request(input), { ok: true, draft, message: 'Check each field.' });
  assert.deepEqual(h.calls.map(c => new URL(c.url).pathname), ['/api/ai-draft']);
  assert.equal('email' in h.calls[0].body, false);
  assert.equal(h.calls[0].body.consent, true);
});
test('disabled, busy, connection and daily-limit server replies survive unchanged', async () => {
  for (const code of ['DISABLED', 'BUSY', 'IP_CAP', 'DAILY_LIMIT']) {
    const error = `Server response for ${code}.`;
    const h = harness([{ ok: false, code, error }]);
    assert.deepEqual(await h.client.request(input), { ok: false, message: error });
  }
});
test('network failure releases busy state so a retry is sent', async () => {
  const h = harness([]);
  assert.equal((await h.client.request(input)).ok, false);
  assert.equal((await h.client.request(input)).ok, false);
  assert.deepEqual(h.calls.map(c => new URL(c.url).pathname), ['/api/ai-draft', '/api/ai-draft']);
});

test('phone source contains no direct model endpoints or provider credentials', async () => {
  const { readdir, readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  let count = 0;
  async function scan(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await scan(path);
      else if (/\.tsx?$/.test(path)) {
        count++;
        assert.doesNotMatch(await readFile(path, 'utf8'), /openrouter\.ai|generativelanguage\.googleapis\.com|api\.openai\.com|(?:OPENROUTER|GEMINI|OPENAI)_API_KEY|sk-or-v1-/i, path);
      }
    }
  }
  await scan('src'); await scan('app');
  assert.ok(count > 0);
});

test('review accepts actual API fields, drops invented tasks and saves only selected details', async () => {
  const { reviewFields, detailStore } = await import('../src/draftReview');
  const reviewed = reviewFields({ weddingDate: '2027-06-12', guestCount: '80', priorities: ['Food', 'Music'], tasks: [{ text: 'invented' }] });
  assert.deepEqual(reviewed, { weddingDate: '2027-06-12', guestCount: '80', priorities: 'Food, Music' });
  const h = harness([]);
  const store = detailStore(h.storage);
  await store.save({ guestCount: reviewed.guestCount });
  assert.deepEqual(await store.read(), { guestCount: '80' });
});

test('opening details and saving an unrelated field preserves the onboarding date', async () => {
  const { initialDetails, detailStore } = await import('../src/draftReview');
  const { dateStore } = await import('../src/weddingDate');
  const h = harness([]);
  const dates = dateStore(h.storage);
  const details = detailStore(h.storage);
  await dates.save('2027-06-12', '2026-11-11');
  await details.save({ weddingDate: '2027-07-01', guestCount: '80' });
  const fields = await initialDetails(details, dates);
  await dates.save(fields.weddingDate!, '2026-11-11');
  await details.save({ ...fields, guestCount: '90' });
  assert.equal(await dates.read(), '2027-06-12');
  assert.equal((await details.read()).guestCount, '90');
});


test('requests use phone-compatible cancellation and clear settled deadlines', async (t) => {
  t.mock.method(AbortSignal, 'timeout', () => { throw new Error('Unavailable on phone'); });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = { async getItem() { return null; }, async setItem() {} };
  const signals: AbortSignal[] = [];
  const client = aiDraftClient(storage, async (_url, init) => {
    signals.push(init.signal as AbortSignal);
    return { ok: true, async json() { return { ok: true, draft: {}, note: 'Ready' }; } };
  });
  assert.equal((await client.request(input)).ok, true);
  t.mock.timers.tick(60000);
  assert.equal(signals.length, 1);
  assert.ok(signals.every(signal => !signal.aborted));
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const stalled = aiDraftClient(storage, async (_url, init) => {
    started();
    return new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
  });
  const request = stalled.request(input);
  await ready;
  t.mock.timers.tick(60000);
  assert.equal((await request).ok, false);
});

test('finding 4: guests, town and budget from the journey fill the details, never over her own', async () => {
  const { journeyDetails } = await import('../src/draftReview');
  assert.deepEqual(journeyDetails({}, { guests: '120', where: 'Memphis', budget: '$10,000 to $25,000' }), { guestCount: '120', locations: 'Memphis', budgetTarget: '$10,000 to $25,000' });
  assert.deepEqual(journeyDetails({ guestCount: '90' }, { guests: '120', where: '', budget: '' }), { guestCount: '90' });
});
