import { loadPayments, refreshPaymentDraft } from '../src/payments';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { amountCents, paymentRows, paymentSummary, paymentGroup, paymentsStore, SAMPLE_PAYMENTS, validatePayment } from '../src/payments';
test('payment schedule uses delivered markers and dates, keeps money local, and gates all paid rows', async () => {
  const own = validatePayment({id:'own:a',payee:'Example C',detail:'Example payment',cents:12345,date:'2027-06-10',method:'Cash'});
  const list = {...SAMPLE_PAYMENTS,tasks:[...SAMPLE_PAYMENTS.tasks,{...SAMPLE_PAYMENTS.tasks[0],id:'other',kind:'task' as const}]};
  assert.deepEqual(paymentRows(list,'2027-06-12',[own],{},false),[]);
  assert.deepEqual(paymentRows(null,'2027-06-12',[own],{},true),[]);
  let rows=paymentRows(list,'2027-06-12',[own],{},true);
  assert.equal(rows.length,3); assert.equal(rows[0].date,'2027-05-13');
  const paid={...rows[0],cents:10000,paidOn:'2027-05-01'};
  rows=paymentRows(list,'2027-06-12',[own],{[paid.id]:paid},true);
  assert.deepEqual(paymentSummary(rows),{total:22345,paid:10000,left:12345,count:2});
  assert.equal(paymentGroup(paid,'2027-06-01'),'Paid');
  assert.equal(paymentGroup({...paid,paidOn:undefined},'2027-06-01'),'Past due');
  assert.equal(paymentGroup(own,'2027-06-01'),'Due in the next 30 days');
  assert.equal(paymentGroup(own,'2027-01-01'),'Later');
  const undone={...paid,paidOn:undefined};
  assert.equal(paymentSummary(paymentRows(list,'2027-06-12',[own],{[paid.id]:undone},true)).left,22345);
  assert.equal(paymentRows(list,'2027-07-12',[],{[paid.id]:paid},true)[0].date,'2027-06-12');
  const memory=new Map<string,string>(); const storage={ getItem:async(k:string)=>memory.get(k)??null,setItem:async(k:string,v:string)=>{memory.set(k,v);} };
  const store=paymentsStore(storage,'example'); await store.save({own:[own],edits:{[paid.id]:paid}});
  assert.deepEqual((await store.read()).own,[own]); assert.equal((await store.read()).edits[paid.id].paidOn,'2027-05-01');
  assert.deepEqual(await paymentsStore(storage,'other-event').read(),{own:[],edits:{}});
  assert.equal(amountCents('123.45'),12345); assert.throws(()=>amountCents('1.234')); assert.throws(()=>amountCents('-1'));
  assert.throws(()=>validatePayment({...own,date:'2027-02-30'}));
  for (const path of ['src/payments.ts','app/(tabs)/payments/index.tsx']) assert.doesNotMatch(readFileSync(path,'utf8'),/\bfetch\s*\(|\bXMLHttpRequest\b|\baxios\b/);
});

 test('padded payment dates persist as ISO days and keep chronological order and urgency', async () => {
  const row = validatePayment({ id: 'own:padded', payee: 'Example', detail: '', cents: 100, date: ' 2027-06-10 ', method: '' });
  assert.equal(row.date, '2027-06-10');
  const memory = new Map<string, string>();
  const store = paymentsStore({ getItem: async key => memory.get(key) ?? null, setItem: async (key, value) => { memory.set(key, value); } }, 'dates');
  await store.save({ own: [row], edits: {} });
  const saved = (await store.read()).own;
  assert.equal(saved[0].date, '2027-06-10');
  assert.deepEqual(paymentRows(SAMPLE_PAYMENTS, '2027-06-12', saved, {}, true).map(r => r.date), ['2027-05-13', '2027-06-05', '2027-06-10']);
  assert.equal(paymentGroup(saved[0], '2027-06-01'), 'Due in the next 30 days');
  assert.equal(paymentGroup(saved[0], '2027-06-11'), 'Past due');
});


test('sharing refresh preserves unsaved payment fields and amount until event or access changes', () => {
  const editing = { id: 'own:draft', payee: 'Example florist', detail: 'Flowers', date: '2027-06-10', cents: 0, method: 'Transfer' };
  const draft = { context: 'shared:event-one', editing, amount: '123.45' };
  const refreshed = refreshPaymentDraft(draft, 'shared:event-one');
  assert.deepEqual(refreshed.editing, editing);
  assert.equal(refreshed.amount, '123.45');
  assert.equal(amountCents(refreshed.amount), 12345);
  for (const context of ['shared:event-two', 'local']) {
    assert.deepEqual(refreshPaymentDraft(refreshed, context), { context, editing: null, amount: '' });
  }
});

test('payment loading ends failed or stalled refreshes and ignores late storage results', async () => {
  const state = { own: [], edits: {} };
  assert.equal(await loadPayments(async () => state), state);
  await assert.rejects(loadPayments(async () => { throw Error('storage unavailable'); }), /storage unavailable/);
  let finish!: (value: typeof state) => void;
  const stalled = new Promise<typeof state>(resolve => { finish = resolve; });
  let applied = false;
  const result = loadPayments(() => stalled, 5).then(value => { applied = true; return value; });
  await assert.rejects(result, /PAYMENTS_LOAD_TIMEOUT/);
  finish(state);
  await assert.rejects(result, /PAYMENTS_LOAD_TIMEOUT/);
  assert.equal(applied, false);
});
