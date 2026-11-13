import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { decryptPlan, encryptPlan, inviteLink, newShareKey, parseInvite, SHARE_UNAVAILABLE } from '../src/sharing/crypto';
import { shareClient, ShareConflict } from '../src/sharing/client';
import { mergeTicks, stampTick, type SharedTicks } from '../src/sharing/ticks';

const rng = (length: number) => new Uint8Array(randomBytes(length));
const alice = 'a'.repeat(32), bob = 'b'.repeat(32);
function server() {
  const requests: { url: string; body: string }[] = [];
  let stored: { ciphertext: string; revision: number } | null = null;
  const id = 'c'.repeat(64);
  const transport: typeof fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, body: String(init?.body ?? '') });
    if (init?.method === 'POST') {
      stored = { ciphertext: JSON.parse(String(init.body)).ciphertext, revision: 1 };
      return Response.json({ id, revision: 1 }, { status: 201 });
    }
    if (new URL(url).searchParams.get('id') !== id || !stored) return Response.json({ error: 'Shared plan unavailable.' }, { status: 404 });
    if (init?.method === 'DELETE') { stored = null; return Response.json({ ok: true }); }
    if (init?.method === 'PUT') {
      const body = JSON.parse(String(init.body));
      if (body.revision !== stored.revision) return Response.json({}, { status: 409 });
      stored = { ciphertext: body.ciphertext, revision: stored.revision + 1 };
      return Response.json({ revision: stored.revision });
    }
    return Response.json(stored);
  };
  return { transport, requests };
}

test('authenticated encryption uses a fresh nonce and refuses wrong keys and tampering', () => {
  const key = newShareKey(rng);
  const text = 'Fictional robots arrange chairs 🌸';
  const first = encryptPlan(text, key, rng), second = encryptPlan(text, key, rng);
  assert.notEqual(first, second);
  assert.equal(decryptPlan(first, key), text);
  assert.throws(() => decryptPlan(first, newShareKey(rng)), { message: SHARE_UNAVAILABLE });
  const bytes = Buffer.from(first, 'base64'); bytes[25] ^= 1;
  assert.throws(() => decryptPlan(bytes.toString('base64'), key), { message: SHARE_UNAVAILABLE });
  assert.throws(() => encryptPlan(text, key, () => new Uint8Array(1)), /randomness/);
});

test('invite key stays in the fragment; server receives ciphertext and capability id only', async () => {
  const fake = server(); const client = shareClient(rng, fake.transport);
  const plaintext = JSON.stringify({ event: 'Fictional robot party' });
  const link = await client.create(plaintext);
  const invite = inviteLink(link);
  assert.deepEqual(parseInvite(invite), link);
  assert.equal(new URL(invite).searchParams.get('key'), null);
  assert.equal(new URL(invite).hash, `#${link.key}`);
  assert.equal((await client.read(parseInvite(invite))).plaintext, plaintext);
  await client.write(link, plaintext, 1);
  await client.stop(link);
  for (const request of fake.requests) {
    assert.ok(!request.url.includes('#'));
    assert.ok(!JSON.stringify(request).includes(link.key));
    assert.ok(!request.body.includes('Fictional robot party'));
    if (request.body) assert.deepEqual(Object.keys(JSON.parse(request.body)).sort(), request.body.includes('revision') ? ['ciphertext', 'revision'] : ['ciphertext']);
  }
  assert.throws(() => parseInvite(invite.replace('weddingchecklistpdf.com', 'example.org')), { message: SHARE_UNAVAILABLE });
  assert.throws(() => parseInvite(invite.split('#')[0]), { message: SHARE_UNAVAILABLE });
});

test('unknown, wrong-key and stopped links have the same client answer', async () => {
  const fake = server(), client = shareClient(rng, fake.transport);
  const owner = 'Fictional private plan kept on owner phone';
  const link = await client.create(owner);
  await assert.rejects(client.read({ ...link, id: 'd'.repeat(64) }), { message: SHARE_UNAVAILABLE });
  await assert.rejects(client.read({ ...link, key: newShareKey(rng) }), { message: SHARE_UNAVAILABLE });
  assert.equal((await client.read(link)).plaintext, owner);
  await client.stop(link);
  await assert.rejects(client.read(link), { message: SHARE_UNAVAILABLE });
  await assert.rejects(client.write(link, 'new', 1), { message: SHARE_UNAVAILABLE });
});

test('two phones ticking different tasks keep both after a revision conflict and merge', async () => {
  const fake = server(), client = shareClient(rng, fake.transport);
  const link = await client.create('{}');
  const a = await client.read(link), b = await client.read(link);
  const first = stampTick(JSON.parse(a.plaintext), 'task-a', true, alice, 10);
  const second = stampTick(JSON.parse(b.plaintext), 'task-b', true, bob, 11);
  await client.write(link, JSON.stringify(first), a.revision);
  await assert.rejects(client.write(link, JSON.stringify(second), b.revision), ShareConflict);
  const latest = await client.read(link);
  const merged = mergeTicks(second, JSON.parse(latest.plaintext));
  await client.write(link, JSON.stringify(merged), latest.revision);
  const result = JSON.parse((await client.read(link)).plaintext) as SharedTicks;
  assert.equal(result['task-a'].done, true);
  assert.equal(result['task-b'].done, true);
  assert.deepEqual(mergeTicks(first, second), mergeTicks(second, first));
  assert.deepEqual(mergeTicks(merged, merged), merged);
});

test('latest untick survives stale snapshots, clock rollback, and equal-time conflicts', () => {
  const first = stampTick({}, 'task', true, alice, 20);
  const unticked = stampTick(first, 'task', false, alice, 19);
  assert.equal(unticked.task.at, 21);
  assert.equal(mergeTicks(first, unticked).task.done, false);
  const tied = stampTick({}, 'task', false, bob, 20);
  assert.equal(mergeTicks(first, tied).task.done, false);
  assert.deepEqual(mergeTicks(first, tied), mergeTicks(tied, first));
  assert.throws(() => mergeTicks({}, { task: { at: NaN, actor: alice, done: true } }), /Invalid shared tick/);
});

test('accepted boundary plans remain readable and writable; oversized envelopes never leave the phone', async () => {
  const fake = server(), client = shareClient(rng, fake.transport);
  const limit = 256 * 1024;
  const overhead = JSON.stringify({ ciphertext: '', revision: Number.MAX_SAFE_INTEGER }).length;
  // XChaCha20-Poly1305: 24-byte nonce + 16-byte tag, then base64.
  const size = Math.floor((limit - overhead) / 4) * 3 - 40;
  const text = 'x'.repeat(size);
  const link = await client.create(text);
  assert.equal((await client.read(link)).plaintext, text);
  assert.equal(await client.write(link, text, 1), 2);
  assert.equal((await client.read(link)).plaintext, text);
  const sent = fake.requests.length;
  await assert.rejects(client.create(text + 'x'), /too large/);
  await assert.rejects(client.write(link, text + 'x', 2), /too large/);
  assert.equal(fake.requests.length, sent);
});

test('oversized writes never leave the phone, and stalled headers or bodies time out', async () => {
  const fake = server(), client = shareClient(rng, fake.transport);
  await assert.rejects(client.create('x'.repeat(256 * 1024)), /too large/);
  assert.equal(fake.requests.length, 0);
  const link = { id: 'c'.repeat(64), key: newShareKey(rng) };
  const stuck: typeof fetch = () => new Promise(() => {});
  await assert.rejects(shareClient(rng, stuck, 5).read(link), /No connection/);
  let cancelled = false;
  const stuckBody: typeof fetch = async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }));
  await assert.rejects(shareClient(rng, stuckBody, 5).read(link), /No connection/);
  assert.equal(cancelled, true);
  const oversized: typeof fetch = async () => new Response('x'.repeat(256 * 1024 + 1));
  await assert.rejects(shareClient(rng, oversized).read(link), { message: SHARE_UNAVAILABLE });
});


test('phone responses without streams support sharing and still enforce size and timeout limits', async () => {
  const fake = server();
  const phone: typeof fetch = async (url, init) => {
    const response = await fake.transport(url, init);
    return { ok: response.ok, status: response.status, body: null, text: () => response.text() } as Response;
  };
  const client = shareClient(rng, phone);
  const link = await client.create('Fictional robot wedding');
  assert.equal((await client.read(link)).plaintext, 'Fictional robot wedding');
  assert.equal(await client.write(link, 'Updated fictional wedding', 1), 2);
  assert.equal((await client.read(link)).plaintext, 'Updated fictional wedding');
  const oversized: typeof fetch = async () => ({ ok: true, status: 200, body: null, text: async () => '🌸'.repeat(256 * 1024 / 4 + 1) } as Response);
  await assert.rejects(shareClient(rng, oversized).read(link), { message: SHARE_UNAVAILABLE });
  // A reply that is not JSON (an error page) shows the same plain sentence, never a parser message.
  const page: typeof fetch = async () => ({ ok: true, status: 200, body: null, text: async () => '<html>busy</html>' } as Response);
  await assert.rejects(shareClient(rng, page).read(link), { message: SHARE_UNAVAILABLE });
  const stalled: typeof fetch = async () => ({ ok: true, status: 200, body: null, text: () => new Promise<string>(() => {}) } as Response);
  await assert.rejects(shareClient(rng, stalled, 5).read(link), /No connection/);
  await client.stop(link);
  await assert.rejects(client.read(link), { message: SHARE_UNAVAILABLE });
});
