import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOWNLOAD_CACHE_KEY, downloadStore } from '../src/billing/downloadStore';
import { TRADITION_PREVIEWS } from '../src/traditionPacks';

// Fictional fixtures, never the private product text.
const id = `$RCAnonymousID:${'a'.repeat(32)}`;
const other = `$RCAnonymousID:${'b'.repeat(32)}`;
const list = { windows: [{ id: 'wedding-week', label: 'Example week' }], tasks: [{ id: 'sample', window: 'wedding-week', text: 'Fictional download test task', daysBefore: 2, owner: '', kind: 'task' }] };
const packs = TRADITION_PREVIEWS.map(p => ({ id: p.id, tasks: [{ id: 'fixture', windowId: 'wedding-week', text: 'Fictional pack download task', source: 'https://example.com/source' }] }));
const manifest = () => ({ active: ['full_plan'], expiresAt: Date.now() + 300000, downloads: ['full-plan', ...packs.map(p => `tradition-${p.id}`)].map((id, i) => ({ id, path: `/api/app-unlock?token=fixture-${i}` })) });
function setup() {
  const data = new Map<string, string>();
  const storage = { async getItem(key: string) { return data.get(key) ?? null; }, async setItem(key: string, value: string) { data.set(key, value); } };
  const calls: { url: string; init?: RequestInit }[] = [];
  const transport: typeof fetch = async (input, init) => {
    const url = String(input); calls.push({ url, init });
    if (init?.method === 'POST') return Response.json(manifest());
    const index = Number(new URL(url).searchParams.get('token')!.split('-')[1]);
    return Response.json(index === 0 ? list : packs[index - 1]);
  };
  return { data, storage, calls, transport };
}

test('verified JSON downloads survive restart offline; Restore rechecks the door and never stores signed links', async () => {
  const s = setup();
  const content = await downloadStore(s.storage, s.transport).refresh(id);
  assert.equal(content.list.tasks.length, list.tasks.length);
  assert.equal(content.packs.length, packs.length);
  assert.equal(s.calls.length, 1 + 1 + packs.length);
  assert.equal(s.calls[0].init?.headers && new Headers(s.calls[0].init.headers).get('authorization'), `Bearer ${id}`);
  for (const call of s.calls) {
    assert.equal(new URL(call.url).origin, 'https://weddingchecklistpdf.com');
    assert.equal(call.init?.redirect, 'error');
    assert.ok(!call.url.includes(id));
    if (call.init?.method === 'GET') assert.equal(call.init.headers, undefined);
  }
  assert.doesNotMatch(s.data.get(DOWNLOAD_CACHE_KEY)!, /fixture-\d|expiresAt|downloads/);
  const offline: typeof fetch = async () => { assert.fail('offline reads must not fetch'); };
  assert.deepEqual(await downloadStore(s.storage, offline).read(id), content);
  assert.equal(await downloadStore(s.storage, offline).read(other), null);
  await downloadStore(s.storage, s.transport).refresh(id);
  assert.equal(s.calls.filter(c => c.init?.method === 'POST').length, 2);
});

test('refused verification, malformed manifests, redirects and incomplete packs never replace saved downloads', async () => {
  const s = setup();
  await downloadStore(s.storage, s.transport).refresh(id);
  const original = s.data.get(DOWNLOAD_CACHE_KEY);
  const badManifests = [
    { ...manifest(), active: [] },
    { ...manifest(), expiresAt: 0 },
    { ...manifest(), downloads: [] },
    { ...manifest(), downloads: [...manifest().downloads, manifest().downloads[0]] },
    ...['https://example.com/file', '//example.com/file', '/api/app-unlock?token=x&next=y'].map(path => ({ ...manifest(), downloads: manifest().downloads.map((d, i) => i ? d : { ...d, path }) })),
  ];
  for (const bad of badManifests) {
    let count = 0;
    const transport: typeof fetch = async () => { count++; return Response.json(bad); };
    await assert.rejects(downloadStore(s.storage, transport).refresh(id));
    assert.equal(count, 1);
    assert.equal(s.data.get(DOWNLOAD_CACHE_KEY), original);
  }
  for (const status of [403, 503, 302]) {
    let count = 0;
    await assert.rejects(downloadStore(s.storage, async () => { count++; return new Response(null, { status }); }).refresh(id));
    assert.equal(count, 1);
  }
  const invalidAssets: unknown[] = [{}, { ...list, tasks: [] }, { ...packs[0], id: 'unknown' }, packs[1]];
  for (const bad of invalidAssets) {
    const transport: typeof fetch = async (input, init) => init?.method === 'POST' ? Response.json(manifest()) : String(input).endsWith('fixture-1') ? Response.json(bad) : s.transport(input, init);
    await assert.rejects(downloadStore(s.storage, transport).refresh(id));
    assert.equal(s.data.get(DOWNLOAD_CACHE_KEY), original);
  }
  await assert.rejects(downloadStore(s.storage, s.transport).refresh('predictable-id'));
  assert.equal(s.data.get(DOWNLOAD_CACHE_KEY), original);
});

test('stalled transport or body, oversized data, corrupt cache and failed writes end visibly; retry still works', async () => {
  const s = setup();
  for (const transport of [
    (async () => new Promise<Response>(() => {})) as typeof fetch,
    (async () => new Response(new ReadableStream({ start() {} }))) as typeof fetch,
    (async () => new Response('x'.repeat(2 * 1024 * 1024 + 1))) as typeof fetch,
  ]) await assert.rejects(downloadStore(s.storage, transport, 20).refresh(id), /Could not download/);
  assert.equal(s.data.size, 0);
  s.data.set(DOWNLOAD_CACHE_KEY, '{bad');
  await assert.rejects(downloadStore(s.storage, s.transport).read(id), /Could not download/);
  let fail = true;
  const store = downloadStore({ ...s.storage, async setItem(key, value) { if (fail) throw Error('disk full'); await s.storage.setItem(key, value); } }, s.transport);
  await assert.rejects(store.refresh(id), /disk full/);
  assert.equal(s.data.get(DOWNLOAD_CACHE_KEY), '{bad');
  fail = false;
  await store.refresh(id);
  assert.equal((await store.read(id))?.list.tasks[0].id, 'sample');
});
