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

test('phone downloads without response streams remain verified, bounded and atomic', async () => {
  const s = setup();
  const phone: typeof fetch = async (url, init) => {
    const response = await s.transport(url, init);
    return { ok: response.ok, body: null, text: () => response.text() } as Response;
  };
  const content = await downloadStore(s.storage, phone).refresh(id);
  assert.deepEqual(content.packs, packs);
  assert.equal(content.list.tasks[0].id, 'sample');
  assert.equal(s.calls.length, 2 + packs.length);
  const original = s.data.get(DOWNLOAD_CACHE_KEY);
  for (const broken of [
    { ok: false, body: null, text: async () => JSON.stringify(manifest()) },
    { ok: true, body: null, text: async () => '🌸'.repeat(524289) },
    { ok: true, body: null, text: async () => '{bad' },
    { ok: true, body: null, text: () => new Promise<string>(() => {}) },
  ]) {
    // Exercise the asset download too: a valid manifest alone must never replace the cache.
    const transport: typeof fetch = async (url, init) => init?.method === 'POST' ? phone(url, init) : broken as Response;
    await assert.rejects(downloadStore(s.storage, transport, 20).refresh(id));
    assert.equal(s.data.get(DOWNLOAD_CACHE_KEY), original);
  }
  assert.deepEqual(await downloadStore(s.storage, async () => { throw Error('offline'); }).read(id), content);
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

test('verified owner who never shared opens every paid view offline and retains edits across restart', async () => {
  const { downloadedOwnerPlan } = await import('../src/billing/ownerPlan');
  const { ACTIVE_EVENT_KEY, EVENT_LEDGER_KEY, eventStore } = await import('../src/billing/eventStore');
  const { activeSharing } = await import('../src/sharing/active');
  const { sharingSession, SHARE_SESSION_KEY } = await import('../src/sharing/session');
  const { taskKey, toggleDone } = await import('@core/plan-progress');
  const { datedFullPlan } = await import('@core/full-plan');
  const { paymentRows } = await import('../src/payments');
  const { weekTasks } = await import('../src/weddingWeek');
  const { packetModel } = await import('../src/packet');
  const { reminderSchedule } = await import('../src/reminders');
  const { addTraditionPack } = await import('../src/traditionPacks');
  const s = setup();
  const event = { id: 'owner-event', name: 'Fictional robot wedding', date: '2028-06-12', dateChanges: 0, fullPlan: true };
  s.data.set(EVENT_LEDGER_KEY, JSON.stringify({ firstEventId: event.id, extras: [], events: [event] }));
  s.data.set(ACTIVE_EVENT_KEY, event.id);
  assert.equal(await downloadedOwnerPlan(s.storage), null); // A ledger flag alone grants no content.
  const payment = { ...list.tasks[0], id: 'sample-payment', text: 'Fictional robot payment', kind: 'payment' };
  const full = { ...list, tasks: [...list.tasks, payment] };
  const transport: typeof fetch = async (url, init) => String(url).endsWith('fixture-0') ? Response.json(full) : s.transport(url, init);
  await downloadStore(s.storage, transport).refresh(id);
  const calls = s.calls.length;
  const makeAccess = () => {
    const noNetwork = async (): Promise<never> => assert.fail('owner views must not contact sharing');
    const session = sharingSession(s.storage, { create: noNetwork, read: noNetwork, write: noNetwork, stop: noNetwork }, 'a'.repeat(32), noNetwork);
    return activeSharing(s.storage, session, eventStore(s.storage).active, () => downloadedOwnerPlan(s.storage));
  };
  const access = makeAccess();
  const plan = (await access.plan())!;
  const progress = await access.progress(async () => assert.fail('owner must have full-plan progress'));
  assert.deepEqual(datedFullPlan(plan.list, event.date, event.date).flatMap(w => w.tasks).map(t => t.id), full.tasks.map(t => t.id));
  assert.equal(paymentRows(plan.list, event.date, [], {}, true).length, 1);
  assert.equal(weekTasks(plan.list, event.date, progress, true).length, full.tasks.length);
  assert.equal(packetModel({ shared: true, names: event.name, date: event.date, progress, unlocked: true, list: plan.list, payments: { own: [], edits: {} }, week: { who: {}, contacts: [] } }).total, full.tasks.length);
  assert.ok(reminderSchedule(event.date, progress, new Date(2028, 0, 1), true, undefined, plan.list).some(r => r.body.includes(full.tasks[0].text)));
  assert.equal(addTraditionPack(progress, plan.packs![0], true).custom.length, 1);
  const key = taskKey(full.tasks[0].window, full.tasks[0].text);
  await access.update(p => toggleDone(p, key, '2028-01-01T00:00:00.000Z'), async () => assert.fail('must update paid progress'));
  assert.equal((await makeAccess().progress(async () => assert.fail('must retain paid progress'))).done[key], '2028-01-01T00:00:00.000Z');
  assert.equal(s.data.has(SHARE_SESSION_KEY), false);
  assert.equal(s.calls.length, calls);
  // Downloaded content cannot unlock an unpaid or deleted/recreated event.
  s.data.set(ACTIVE_EVENT_KEY, 'new-event');
  s.data.set(EVENT_LEDGER_KEY, JSON.stringify({ firstEventId: event.id, extras: [], events: [event, { ...event, id: 'new-event', fullPlan: false }] }));
  assert.equal(await makeAccess().plan(), null);
  s.data.delete(ACTIVE_EVENT_KEY);
  assert.equal(await makeAccess().plan(), null);
});

test('verified extras download atomically, survive offline restart, and never fetch without the server grant', async () => {
  const s = setup();
  // An empty fictional ZIP, no paid content. Exercise the native no-stream transport too.
  const zip = new Uint8Array(22); zip.set([0x50, 0x4b, 5, 6]);
  const extraIds = ['printables', 'day-of-kit'];
  let active = ['full_plan', 'printables', 'day_of_kit'];
  let broken = '';
  let native = false;
  const fetched: string[] = [];
  const transport: typeof fetch = async (url, init) => {
    if (init?.method === 'POST') return Response.json({ ...manifest(), active, downloads: [
      ...manifest().downloads, ...extraIds.map(id => ({ id, path: `/api/app-unlock?token=${id}` })),
    ] });
    const asset = new URL(String(url)).searchParams.get('token')!;
    if (!extraIds.includes(asset)) return s.transport(url, init);
    fetched.push(asset);
    if (broken === 'stall') return new Promise<Response>(() => {});
    const bytes = broken === 'cache-large' ? (() => { const b = new Uint8Array(600000); b.set(zip); return b; })() : broken === 'large' ? new Uint8Array(2 * 1024 * 1024 + 1) : broken === 'invalid' ? new Uint8Array(22) : zip;
    const response = new Response(bytes, { status: broken === 'refused' ? 403 : 200 });
    return native ? { ok: response.ok, body: null, arrayBuffer: () => response.arrayBuffer() } as Response : response;
  };
  for (const phone of [false, true]) {
    native = phone;
    const content = await downloadStore(s.storage, transport).refresh(id);
    assert.deepEqual(Object.keys(content.archives!), extraIds);
    assert.equal(content.archives!.printables, Buffer.from(zip).toString('hex'));
    assert.deepEqual(await downloadStore(s.storage, async () => assert.fail('offline read')).read(id), content);
    const saved = s.data.get(DOWNLOAD_CACHE_KEY);
    for (const failure of ['refused', 'large', 'cache-large', 'invalid', 'stall']) {
      broken = failure;
      await assert.rejects(downloadStore(s.storage, transport, 10).refresh(id));
      assert.equal(s.data.get(DOWNLOAD_CACHE_KEY), saved);
    }
    broken = '';
  }
  active = ['full_plan']; fetched.length = 0;
  const plain = await downloadStore(s.storage, transport).refresh(id);
  assert.equal(plain.archives, undefined);
  assert.deepEqual(fetched, []);
  active = []; fetched.length = 0;
  await assert.rejects(downloadStore(s.storage, transport).refresh(id));
  assert.deepEqual(fetched, []);
});
