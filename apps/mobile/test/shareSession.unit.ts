import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { taskKey } from '../../../lib/plan-progress';
import { shareClient } from '../src/sharing/client';
import { inviteLink, newShareKey, SHARE_UNAVAILABLE } from '../src/sharing/crypto';
import { sharedPlan, sharingSession, SHARE_SESSION_KEY, type SharedPlan } from '../src/sharing/session';
import { deleteLocalPlan } from '../src/deletePlan';

const rng = (size: number) => new Uint8Array(randomBytes(size));
const list = { windows: [{ id: 'wedding-week', label: 'Example week' }], tasks: [
  { id: 'chairs', window: 'wedding-week', text: 'Fictional robots arrange violet chairs', daysBefore: 2, owner: '', kind: 'task' as const },
  { id: 'payment', window: 'wedding-week', text: 'Fictional robots pay for marmalade', daysBefore: 1, owner: '', kind: 'payment' as const },
] };
const fixture = (): SharedPlan => ({ event: { id: 'event-1', name: 'Fictional robot wedding', date: '2028-06-12' }, list, ticks: {}, joined: false });
const keys = list.tasks.map(task => taskKey(task.window, task.text));
function phone() {
  const data = new Map<string, string>([['dw.billing.events.v1', 'personal purchase history'], ['dw-plan-progress', 'personal ticks'], ['dw.wedding-date.v1', '2030-06-12']]);
  const storage = {
    async getItem(key: string) { return data.get(key) ?? null; },
    async setItem(key: string, value: string) { data.set(key, value); },
    async removeMany(keys: string[]) { keys.forEach(key => data.delete(key)); },
  };
  return { data, storage };
}
function server() {
  const documents = new Map<string, { ciphertext: string; revision: number }>();
  let sequence = 0, offline = false, outage = false, conflict = false;
  const calls: string[] = [];
  const transport: typeof fetch = async (input, init) => {
    calls.push(String(input));
    if (offline) throw Error('No connection');
    if (outage) return Response.json({}, { status: 503 });
    const id = new URL(String(input)).searchParams.get('id')!;
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (init?.method === 'POST') {
      const id = (++sequence).toString(16).padStart(64, '0');
      documents.set(id, { ciphertext: body.ciphertext, revision: 1 });
      return Response.json({ id, revision: 1 });
    }
    const current = documents.get(id);
    if (init?.method === 'DELETE') { documents.delete(id); return Response.json({ ok: true }); }
    if (!current) return Response.json({}, { status: 404 });
    if (init?.method === 'PUT') {
      if (body.revision !== current.revision || conflict) return Response.json({}, { status: 409 });
      documents.set(id, { ciphertext: body.ciphertext, revision: current.revision + 1 });
      return Response.json({ revision: current.revision + 1 });
    }
    return Response.json(current);
  };
  return { documents, calls, client: shareClient(rng, transport), offline: (v: boolean) => { offline = v; }, outage: (v: boolean) => { outage = v; }, conflict: (v: boolean) => { conflict = v; } };
}

test('invite requires verified owner content; inspection changes nothing; joined access uses the entire delivered list without purchases', async () => {
  const s = server(), owner = phone(), partner = phone();
  let verified = false, checks = 0;
  const a = sharingSession(owner.storage, s.client, 'a'.repeat(32), async () => { checks++; return verified ? fixture() : null; });
  await assert.rejects(a.invite(), /full plan is needed/);
  assert.equal(s.calls.length, 0);
  verified = true;
  const invite = inviteLink((await a.invite()).link);
  const b = sharingSession(partner.storage, s.client, 'b'.repeat(32), async () => { assert.fail('Joined phone never asks for a purchase'); });
  const before = [...partner.data];
  assert.deepEqual(await b.inspect(invite), fixture().event);
  assert.deepEqual([...partner.data], before);
  const joined = await b.join(invite);
  assert.equal(joined?.role, 'joined');
  assert.deepEqual(joined?.plan.list, list);
  assert.equal(joined?.plan.list.tasks.length, list.tasks.length);
  assert.equal((await a.sync())?.plan.joined, true);
  assert.equal(checks, 2);
  for (const [key, value] of before) assert.equal(partner.data.get(key), value);
  assert.equal(partner.data.size, before.length + 1);
  assert.ok(!s.calls.some(call => call.includes('#')));
  for (const document of s.documents.values()) assert.ok(!document.ciphertext.includes(list.tasks[0].text));
});

test('offline ticks survive restart, merge both phones and payment completion, and preserve later unticks', async () => {
  const s = server(), owner = phone(), partner = phone();
  let time = 10;
  const a = sharingSession(owner.storage, s.client, 'a'.repeat(32), async () => fixture(), () => time);
  const invite = inviteLink((await a.invite()).link);
  let b = sharingSession(partner.storage, s.client, 'b'.repeat(32), async () => null, () => time);
  await b.join(invite);
  s.offline(true);
  await a.tick(keys[0], true);
  await b.tick(keys[1], true);
  await assert.rejects(b.sync(), /No connection/);
  b = sharingSession(partner.storage, s.client, 'b'.repeat(32), async () => null, () => time);
  assert.equal((await b.read())?.plan.ticks[keys[1]].done, true);
  s.offline(false);
  await Promise.all([a.sync(), b.sync()]);
  await Promise.all([a.sync(), b.sync()]);
  for (const session of [await a.read(), await b.read()]) {
    assert.equal(session?.plan.ticks[keys[0]].done, true);
    assert.equal(session?.plan.ticks[keys[1]].done, true);
  }
  time = 9; // Clock rollback cannot resurrect the old tick.
  await b.tick(keys[0], false);
  await b.sync(); await a.sync();
  assert.equal((await a.read())?.plan.ticks[keys[0]].done, false);
  assert.equal((await a.read())?.plan.ticks[keys[0]].at, 11);
});

test('temporary outages keep access; stopping removes joined access after sync and preserves both personal plans', async () => {
  const s = server(), owner = phone(), partner = phone();
  const ownBefore = [...owner.data], partnerBefore = [...partner.data];
  const a = sharingSession(owner.storage, s.client, 'a'.repeat(32), async () => fixture());
  const b = sharingSession(partner.storage, s.client, 'b'.repeat(32), async () => null);
  await b.join(inviteLink((await a.invite()).link));
  s.outage(true);
  await assert.rejects(b.sync(), { message: SHARE_UNAVAILABLE });
  assert.ok((await b.read())?.plan.list);
  await assert.rejects(a.stop());
  assert.ok(await a.read());
  s.outage(false);
  await a.stop();
  assert.equal(await a.read(), null);
  assert.equal(await b.sync(), null);
  assert.equal(await b.read(), null);
  assert.equal(partner.data.get(SHARE_SESSION_KEY), 'null');
  for (const [key, value] of ownBefore) assert.equal(owner.data.get(key), value);
  for (const [key, value] of partnerBefore) assert.equal(partner.data.get(key), value);
});

test('leave affects only the joined phone, and wrong-key/unknown joins neither overwrite nor grant access', async () => {
  const s = server(), owner = phone(), partner = phone();
  const a = sharingSession(owner.storage, s.client, 'a'.repeat(32), async () => fixture());
  const link = (await a.invite()).link;
  const b = sharingSession(partner.storage, s.client, 'b'.repeat(32), async () => null);
  const before = [...partner.data];
  for (const bad of [{ ...link, key: newShareKey(rng) }, { ...link, id: 'f'.repeat(64) }]) {
    await assert.rejects(b.join(inviteLink(bad)), { message: SHARE_UNAVAILABLE });
    assert.deepEqual([...partner.data], before);
    assert.equal(await b.read(), null);
  }
  await b.join(inviteLink(link));
  await assert.rejects(b.stop(), /Only the inviting phone/);
  await assert.rejects(a.leave(), /Stop sharing/);
  await assert.rejects(b.invite(), /Leave or stop/);
  await b.leave();
  assert.equal(await b.read(), null);
  assert.ok(await a.sync());
  assert.equal(s.documents.size, 1);
});

test('invalid snapshots, conflict exhaustion and storage failures stay visible without discarding pending ticks', async () => {
  for (const bad of [null, {}, { ...fixture(), event: { ...fixture().event, date: '2028-02-30' } }, { ...fixture(), ticks: { unknown: { at: 1, actor: 'a'.repeat(32), done: true } } }, { ...fixture(), list: { ...list, tasks: [list.tasks[0], list.tasks[0]] } }]) assert.throws(() => sharedPlan(bad));
  const extra = sharedPlan({ ...fixture(), payments: [{ amount: 100 }], userId: 'private', event: { ...fixture().event, receipt: 'private' } });
  assert.deepEqual(extra, sharedPlan(fixture()));
  const s = server(), owner = phone();
  const a = sharingSession(owner.storage, s.client, 'a'.repeat(32), async () => fixture());
  await a.invite();
  await a.tick(keys[0], true);
  const before = owner.data.get(SHARE_SESSION_KEY);
  await assert.rejects(a.tick('unknown', true));
  assert.equal(owner.data.get(SHARE_SESSION_KEY), before);
  s.conflict(true);
  const count = s.calls.length;
  await assert.rejects(a.sync(), /Try syncing again/);
  assert.equal(s.calls.length - count, 6); // Three bounded read/write attempts.
  assert.equal(owner.data.get(SHARE_SESSION_KEY), before);
  s.conflict(false);
  await a.sync();
  const fail = sharingSession({ ...owner.storage, async setItem() { throw Error('disk full'); } }, s.client, 'a'.repeat(32), async () => null);
  await assert.rejects(fail.tick(keys[0], false), /disk full/);
  assert.equal((await a.read())?.plan.ticks[keys[0]].done, true);
  owner.data.set(SHARE_SESSION_KEY, '{broken');
  await assert.rejects(a.read(), { message: SHARE_UNAVAILABLE });
});

test('deleting local plan removes the shared-access cache and key while retaining purchase history', async () => {
  const s = server(), owner = phone();
  await sharingSession(owner.storage, s.client, 'a'.repeat(32), async () => fixture()).invite();
  await deleteLocalPlan(owner.storage, async () => {}, async () => {});
  assert.equal(owner.data.has(SHARE_SESSION_KEY), false);
  assert.equal(owner.data.get('dw.billing.events.v1'), 'personal purchase history');
});

test('shared own-task additions, edits, removals and ticks merge offline without resurrecting deleted tasks', async () => {
  const s = server(), owner = phone(), partner = phone();
  let at = 100;
  const a = sharingSession(owner.storage,s.client,'a'.repeat(32),async()=>fixture(),()=>at);
  const b = sharingSession(partner.storage,s.client,'b'.repeat(32),async()=>null,()=>at);
  await b.join(inviteLink((await a.invite()).link));
  s.offline(true);
  await a.updateProgress(p=>({...p,custom:[...p.custom,{id:'a',windowId:'wedding-week',text:'Fictional violet robots rehearse'}]}));
  await b.updateProgress(p=>({...p,custom:[...p.custom,{id:'b',windowId:'wedding-week',text:'Fictional orange robots rehearse'}]}));
  s.offline(false);
  await a.sync(); await b.sync(); await a.sync();
  assert.equal((await a.read())?.plan.custom?.a.value?.text,'Fictional violet robots rehearse');
  assert.equal((await b.read())?.plan.custom?.b.value?.text,'Fictional orange robots rehearse');
  at++;
  await b.updateProgress(p=>({...p,custom:p.custom.map(t=>t.id==='a'?{...t,text:'Fictional violet robots dance'}:t),done:{...p.done,'own::a':new Date(at).toISOString()}}));
  await b.sync(); await a.sync();
  assert.equal((await a.read())?.plan.custom?.a.value?.text,'Fictional violet robots dance');
  assert.equal((await a.read())?.plan.ticks['own::a'].done,true);
  at++;
  await a.updateProgress(p=>({...p,custom:p.custom.filter(t=>t.id!=='a')}));
  await a.sync(); await b.sync(); await a.sync();
  assert.equal((await b.read())?.plan.custom?.a.value,null);
  assert.equal((await a.read())?.plan.custom?.a.value,null);
});

test('active shared access drives full list, payments, packet and week, then restores the personal plan after revocation', async () => {
  const { activeSharing, OWNER_PLAN_KEY } = await import('../src/sharing/active');
  const { sharedProgress } = await import('../src/sharing/session');
  const { paymentRows } = await import('../src/payments');
  const { packetModel } = await import('../src/packet');
  const { weekTasks } = await import('../src/weddingWeek');
  const { reminderSchedule } = await import('../src/reminders');
  const s=server(), owner=phone(), partner=phone();
  const a=sharingSession(owner.storage,s.client,'a'.repeat(32),async()=>fixture());
  const b=sharingSession(partner.storage,s.client,'b'.repeat(32),async()=>null);
  const ownerAccess=activeSharing(owner.storage,a,async()=>({id:'event-1'}));
  const joinedAccess=activeSharing(partner.storage,b,async()=>null);
  await b.join(inviteLink((await a.invite()).link));
  await b.tick(keys[1],true);
  const plan=(await joinedAccess.plan())!;
  const progress=await joinedAccess.progress(async()=>assert.fail('must use shared overlay'));
  assert.equal(Object.keys(progress.done).length,1);
  assert.equal(paymentRows(plan.list,plan.event.date,[],{},true).length,1);
  assert.equal(weekTasks(plan.list,plan.event.date,progress,true).length,list.tasks.length);
  const model=packetModel({names:plan.event.name,date:plan.event.date,progress,unlocked:true,list:plan.list,payments:{own:[],edits:{}},week:{who:{},contacts:[]}});
  assert.equal(model.total,list.tasks.length);
  assert.ok(reminderSchedule(plan.event.date,progress,new Date(2027,0,1),true,undefined,plan.list).some(r=>r.body.includes(list.tasks[0].text)));
  await b.sync(); await a.sync();
  await ownerAccess.stop();
  assert.ok(owner.data.has(OWNER_PLAN_KEY));
  assert.equal((await ownerAccess.plan())?.list.tasks.length,list.tasks.length);
  assert.ok(sharedProgress((await ownerAccess.plan())!).done[keys[1]]);
  await b.sync();
  assert.equal(await joinedAccess.plan(),null);
  const personal={done:{personal:'2020-01-01'},custom:[]};
  assert.deepEqual(await joinedAccess.progress(async()=>personal),personal);
  assert.equal(partner.data.get('dw.billing.events.v1'),'personal purchase history');
  assert.equal(partner.data.get('dw-plan-progress'),'personal ticks');
});

test('only the owner updates event metadata and every recorded event can be backed up without granting the partner a purchase', async()=>{
  const s=server(), owner=phone(), partner=phone();
  const history={firstEventId:'event-1',extras:[],events:[{...fixture().event,fullPlan:true,dateChanges:0},{id:'event-2',name:'Fictional second robot event',date:'2029-06-12',fullPlan:true,dateChanges:1}]};
  const a=sharingSession(owner.storage,s.client,'a'.repeat(32),async()=>({...fixture(),history}));
  const b=sharingSession(partner.storage,s.client,'b'.repeat(32),async()=>null);
  await b.join(inviteLink((await a.invite()).link));
  await assert.rejects(b.updateOwnerEvent({...fixture().event,date:'2028-06-13'}));
  await a.updateOwnerEvent({...fixture().event,date:'2028-06-13'}); await a.sync(); await b.sync();
  assert.equal((await b.read())?.plan.event.date,'2028-06-13');
  assert.equal((await b.read())?.plan.history?.events.length,2);
  assert.equal(partner.data.get('dw.billing.events.v1'),'personal purchase history');
});

test('shared full-pack provenance survives joining, removal and undo',async()=>{
  const {addTraditionPack,removeTraditionPack,restoreTraditionTasks}=await import('../src/traditionPacks');
  const {sharedProgress}=await import('../src/sharing/session');
  const pack={id:'catholic',tasks:[{id:'robots',windowId:'wedding-week',text:'Fictional robots carry violet umbrellas',source:'https://example.com/fictional'}]};
  const s=server(),owner=phone(),partner=phone();
  const a=sharingSession(owner.storage,s.client,'a'.repeat(32),async()=>({...fixture(),packs:[pack]}));
  const b=sharingSession(partner.storage,s.client,'b'.repeat(32),async()=>null);
  await b.join(inviteLink((await a.invite()).link));
  await b.updateProgress(p=>addTraditionPack(p,pack,true));await b.sync();await a.sync();
  const before=sharedProgress((await a.read())!.plan);
  assert.equal(before.custom.length,1);
  await a.updateProgress(p=>removeTraditionPack(p,'catholic'));await a.sync();await b.sync();
  assert.equal(sharedProgress((await b.read())!.plan).custom.length,0);
  await b.updateProgress(p=>restoreTraditionTasks(p,before.custom));await b.sync();await a.sync();
  assert.deepEqual(sharedProgress((await a.read())!.plan).custom,before.custom);
});

test('stopping drains pending writes before preserving the owner; local deletion never clears remote ticks',async()=>{
  const {activeSharing}=await import('../src/sharing/active');
  const s=server(),owner=phone(),partner=phone();
  const a=sharingSession(owner.storage,s.client,'a'.repeat(32),async()=>fixture());
  const b=sharingSession(partner.storage,s.client,'b'.repeat(32),async()=>null);
  await b.join(inviteLink((await a.invite()).link));
  const pending=a.tick(keys[0],true);
  const access=activeSharing(owner.storage,a,async()=>({id:'event-1',date:'2028-06-13'}));
  await access.stop();await pending;
  assert.equal((await access.plan())?.ticks[keys[0]].done,true);
  assert.equal((await access.plan())?.event.date,'2028-06-13');
  // A second independent share proves deleting one phone does not publish an empty plan.
  const fresh=sharingSession(phone().storage,s.client,'c'.repeat(32),async()=>fixture());
  await fresh.invite();await fresh.tick(keys[0],true);await fresh.sync();
  const snapshot=JSON.stringify([...s.documents]);
  await a.drain();
  await deleteLocalPlan(owner.storage,async()=>{},a.drain);
  assert.equal(JSON.stringify([...s.documents]),snapshot);
});
