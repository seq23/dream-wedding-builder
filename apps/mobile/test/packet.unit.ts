import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLAN_WINDOWS } from '@core/dated-plan';
import { emptyProgress, taskKey } from '@core/plan-progress';
import { SAMPLE_PAYMENTS } from '../src/payments';
import { packetModel, packetHtml, paperSize, sharePacket, type PacketInput, type Paper } from '../src/packet';
const input = (): PacketInput => ({ names: '<script>bad()</script>', date: '2027-06-12', progress: emptyProgress(), unlocked: true, list: SAMPLE_PAYMENTS, payments: { own: [], edits: {} }, week: { who: {}, contacts: [{ id:'a',name:'Sample contact',phone:'123',arrival:'10am',caller:'Friend' }] } });
test('free packet excludes delivered paid content even when supplied; retains personal task identity', () => {
  const data = input(); data.unlocked = false;
  data.progress.custom.push({ id:'own',windowId:'12-plus',text:'My personal task' }); data.progress.done['own::own'] = '2026-11-11';
  const model = packetModel(data);
  assert.equal(model.total, PLAN_WINDOWS.reduce((n,w)=>n+w.tasks.length,0)+1);
  assert.equal(model.sections.flatMap(s=>s.tasks).find(t=>t.text==='My personal task')?.done,true);
  assert.equal(model.payments.length,0); assert.equal(model.contacts.length,0); assert.equal(model.week.length,0);
  const html = packetHtml(data,'Letter');
  for (const t of SAMPLE_PAYMENTS.tasks) assert.ok(!html.includes(t.text));
  assert.ok(!html.includes('Sample contact')); assert.ok(!html.includes('<script>')); assert.ok(html.includes('&lt;script&gt;'));
});
test('paid packet includes every delivered task, dates, ticks, assignment, payment and contacts', () => {
  const data = input(); const first = data.list!.tasks[0]; data.progress.done[taskKey(first.window,first.text)] = '2026-11-11';
  const last = data.list!.tasks[1]; data.week.who[taskKey(last.window,last.text)] = 'My helper';
  data.payments.edits[`task:${last.id}`] = { id:`task:${last.id}`,payee:'Sample payee',detail:'',cents:12345,date:'2027-06-05',method:'Envelope' };
  const model = packetModel(data); assert.equal(model.total,data.list!.tasks.length);
  assert.equal(model.sections.flatMap(s=>s.tasks).filter(t=>t.done).length,1); assert.equal(model.week.length,1); assert.equal(model.week[0].date,'2027-06-05');
  const html = packetHtml(data,'A4'); for (const task of data.list!.tasks) assert.ok(html.includes(task.text));
  for (const value of ['My helper','Sample payee','$123.45','Sample contact','Envelope']) assert.ok(html.includes(value));
});
test('both paper sizes create and share the local file; export failure never shares', async () => {
  for (const paper of ['Letter','A4'] as Paper[]) {
    let shared = ''; let writes = 0;
    const uri = await sharePacket(input(),paper, { print: async o => { writes++; assert.equal(o.width,paperSize[paper].width); assert.equal(o.height,paperSize[paper].height); assert.ok(o.html.startsWith('<!DOCTYPE html>')); return {uri:`file:///packet-${paper}.pdf`}; }, share: async v => {shared=v;} });
    assert.equal(writes,1); assert.equal(shared,uri);
  }
  await assert.rejects(sharePacket(input(),'Letter',{ print:async()=>({uri:''}),share:async()=>{assert.fail('must not share');} }));
  await assert.rejects(sharePacket(input(),'A4',{ print:async()=>{throw new Error('Disk full');},share:async()=>{assert.fail('must not share');} }),/Disk full/);
});

test('web printing opens on the gesture, writes the packet before printing, and reports popup blocking', async () => {
  const { preparePacketOutput } = await import('../src/packetOutput.web');
  const original = Object.getOwnPropertyDescriptor(globalThis,'window');
  const calls: string[] = []; let html = '';
  try {
    Object.defineProperty(globalThis,'window',{ configurable:true, value: { open: () => { calls.push('open'); return { opener:{}, document:{open(){calls.push('document');},write(value:string){html=value;calls.push('write');},close(){calls.push('ready');}},focus(){calls.push('focus');},print(){calls.push('print');},close(){calls.push('close');} }; } } });
    const output = preparePacketOutput(); assert.deepEqual(calls,['open']);
    await output.write(input(),'A4'); assert.deepEqual(calls,['open','document','write','ready','focus','print']);
    assert.ok(html.includes('Example vendor balance')); assert.ok(html.includes('size: A4'));
    output.cancel(); assert.equal(calls.at(-1),'close');
    Object.defineProperty(globalThis,'window',{ configurable:true, value: { open:()=>null } });
    assert.throws(()=>preparePacketOutput(),/print window/);
  } finally { if(original) Object.defineProperty(globalThis,'window',original); else Reflect.deleteProperty(globalThis,'window'); }
});
