import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiDraftClient } from '../src/aiDraft';
const input = { email: ['couple', 'example.test'].join('@'), description: 'A small wedding next summer', consent: true, marketing: false };
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
test('no consent sends nothing, including signup', async () => {
  const h = harness([]);
  assert.equal((await h.client.request({ ...input, consent: false, marketing: true })).ok, false);
  assert.deepEqual(h.calls, []);
});
test('signup precedes draft; AI consent never becomes marketing; reopening skips signup', async () => {
  const draft = { weddingDate: '2027-06-12' };
  const h = harness([{ ok: true }, { ok: true, draft, note: 'Check each field.' }]);
  assert.deepEqual(await h.client.request(input), { ok: true, draft, message: 'Check each field.' });
  assert.deepEqual(h.calls.map(c => new URL(c.url).pathname), ['/api/builder-signup', '/api/ai-draft']);
  assert.equal(h.calls[0].body.marketing, false);
  assert.equal('consent' in h.calls[0].body, false);
  assert.equal(h.calls[1].body.consent, true);
  const reopened = aiDraftClient(h.storage, async url => {
    assert.equal(new URL(url).pathname, '/api/ai-draft');
    return { ok: true, async json() { return { ok: true, draft, note: 'Again' }; } };
  });
  assert.equal((await reopened.request(input)).ok, true);
});
test('marketing needs its own tick and failed signup never sends the sentence', async () => {
  const h = harness([{ ok: false, error: 'Signup unavailable.' }]);
  assert.deepEqual(await h.client.request({ ...input, marketing: true }), { ok: false, message: 'Signup unavailable.' });
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].body.marketing, true);
  assert.equal('description' in h.calls[0].body, false);
});
test('disabled, busy, used, connection and daily-limit server replies survive unchanged', async () => {
  for (const code of ['DISABLED', 'BUSY', 'EMAIL_USED', 'IP_CAP', 'DAILY_LIMIT']) {
    const error = `Server response for ${code}.`;
    const h = harness([{ ok: true }, { ok: false, code, error }]);
    assert.deepEqual(await h.client.request(input), { ok: false, message: error });
  }
});
test('network failure releases busy state and retry skips a successful signup', async () => {
  const h = harness([{ ok: true }]);
  assert.equal((await h.client.request(input)).ok, false);
  assert.equal((await h.client.request(input)).ok, false);
  assert.deepEqual(h.calls.map(c => new URL(c.url).pathname), ['/api/builder-signup', '/api/ai-draft', '/api/ai-draft']);
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

test('remembered email can opt into marketing on retry and the choice survives reopening', async () => {
  const h = harness([{ ok: true }, { ok: false }, { ok: true }, { ok: true, draft: {}, note: 'Ready' }]);
  await h.client.request(input);
  assert.equal((await h.client.request({ ...input, marketing: true })).ok, true);
  assert.deepEqual(h.calls.map(c => new URL(c.url).pathname), ['/api/builder-signup', '/api/ai-draft', '/api/builder-signup', '/api/ai-draft']);
  assert.equal(h.calls[2].body.marketing, true);
  const reopened = aiDraftClient(h.storage, async url => {
    assert.equal(new URL(url).pathname, '/api/ai-draft');
    return { ok: true, async json() { return { ok: true, draft: {}, note: 'Ready' }; } };
  });
  assert.equal((await reopened.request({ ...input, marketing: true })).ok, true);
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
