import { savedProgress } from '../../../src/savedProgress';
import { sharingDetails } from '../../../src/sharing/details';
import { SHARED_PAYMENTS_KEY } from '../../../src/sharing/active';
import { taskKey, toggleDone } from '@core/plan-progress';
import { activePlan } from '../../../src/sharing/runtime';
import { useSharingRevision } from '../../../src/sharing/useSharing';
import type { SharedPlan } from '../../../src/sharing/session';
import { useState, useCallback } from 'react';
import { Text, TextInput, Pressable, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localToday } from '@core/dated-plan';
import { FULL_PLAN_TEASER } from '@core/full-plan-teaser';
import { datedFullPlan } from '@core/full-plan';
import { PlannedScreen, GoButton } from '../../../src/ui';
import { WeddingDatePicker } from '../../../src/WeddingDatePicker';
import { savedDate } from '../../../src/savedDate';
import { color, type, space } from '../../../src/theme';
import { refreshPaymentDraft, type PaymentDraft, amountCents, paymentRows, paymentSummary, paymentGroup, paymentsStore, validatePayment, SAMPLE_PAYMENTS, type Payment, type PaymentState } from '../../../src/payments';
const preview = process.env.EXPO_PUBLIC_DW_PREVIEW === '1';
const store = paymentsStore(AsyncStorage, preview ? 'dw.payments.preview.v1' : 'dw.payments.v1');
const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n/100);
export default function Payments() {
  const sharingRevision = useSharingRevision();
  const [shared, setShared] = useState<SharedPlan | null>(null);
  const [done,setDone] = useState<Record<string,string>>({});
  const [date,setDate] = useState<string|null>(null);
  const [state,setState] = useState<PaymentState>({ own: [], edits: {} });
  const [ready,setReady] = useState(false); const [busy,setBusy] = useState(false);
  const [draft,setDraft] = useState<PaymentDraft>({ context: null, editing: null, amount: '' });
  const { editing, amount } = draft;
  const setEditing = (editing: Payment | null) => setDraft(current => ({ ...current, editing }));
  const setAmount = (amount: string) => setDraft(current => ({ ...current, amount }));
  const [error,setError] = useState('');
  useFocusEffect(useCallback(() => { let active=true; setReady(false); Promise.all([savedDate.read(),activePlan(),savedProgress.read()]).then(async ([d,plan,progress]) => { const s = plan ? await sharingDetails(AsyncStorage,SHARED_PAYMENTS_KEY,plan.event.id,()=>({own:[],edits:{}} as PaymentState)).read() : await store.read(); return [d,s,plan,progress] as const; }).then(([d,s,plan,progress]) => { if(active) {setDraft(current => refreshPaymentDraft(current, plan ? `shared:${plan.event.id}` : 'local'));setShared(plan);setDate(d);setState(s);setDone(progress.done);setReady(true);} }).catch(() => { if(active) setError('Could not load payments. Reopen this tab to try again.'); }); return () => {active=false;}; },[sharingRevision]));
  // Purchase delivery remains closed. Preview data is isolated from real records.
  const rows = paymentRows(shared?.list ?? (preview ? SAMPLE_PAYMENTS : null), date ?? '', state.own, state.edits, !!shared || preview).map(row => { const task = shared?.list.tasks.find(t => row.id === `task:${t.id}`); return task ? { ...row, paidOn: done[taskKey(task.window,task.text)]?.slice(0,10) } : row; });
  const summary = paymentSummary(rows); const today = localToday();
  async function save(row: Payment) {
    setBusy(true); setError('');
    try { row = validatePayment(row); const next = row.id.startsWith('task:') ? { ...state, edits: { ...state.edits, [row.id]: row } } : { ...state, own: [...state.own.filter(r=>r.id!==row.id),row] };
      if (shared) await sharingDetails(AsyncStorage,SHARED_PAYMENTS_KEY,shared.event.id,()=>({own:[],edits:{}} as PaymentState)).save(next); else await store.save(next); setState(next); setEditing(null);
    } catch(e) { setError(e instanceof Error ? e.message : 'Could not save. Try again.'); } finally {setBusy(false);}
  }
  async function complete(row: Payment) {
    if (!shared || !row.id.startsWith('task:')) return save({...row,paidOn:row.paidOn ? undefined : today});
    const task = shared.list.tasks.find(t => row.id === `task:${t.id}`);
    if (!task) return;
    setBusy(true);
    try { setDone((await savedProgress.update(p => toggleDone(p,taskKey(task.window,task.text),new Date().toISOString()))).done); }
    catch { setError('Could not save your payment tick. Try again.'); }
    finally { setBusy(false); }
  }
  function button(label:string, action:()=>void) { return <Pressable accessibilityRole="button" disabled={busy} onPress={action} style={{ minHeight:48, justifyContent:'center' }}><Text style={[type.button,{color:color.blue}]}>{label}</Text></Pressable>; }
  function field(label:string, value:string, change:(s:string)=>void) { return <TextInput accessibilityLabel={label} placeholder={label} value={value} onChangeText={change} style={[type.body,{borderWidth:1,borderColor:color.rule,padding:12,color:color.midnight}]} />; }
  const locked = datedFullPlan({ windows:[{id:'locked',label:'Payments'}], tasks:[FULL_PLAN_TEASER['12-plus'][1],FULL_PLAN_TEASER['3-months'][1]].map((t,i)=>({...t,id:String(i),window:'locked',owner:'',kind:'payment' as const})) },date ?? '',today).flatMap(s=>s.tasks);
  return <PlannedScreen route="/payments" implemented>
    {error ? <Text accessibilityRole="alert" style={[type.body,{color:color.redPen}]}>{error}</Text> : null}
    {!ready ? <Text style={type.body}>Loading payments…</Text> : !date ? <GoButton href="/welcome" label="Set your wedding date ›" /> : !preview && !shared ? <>
      <Text style={type.title}>Your payment schedule</Text><Text style={type.body}>The full plan adds dated payments, your own payments, and a running total still owed.</Text>
      {locked.map(r=><Text key={r.id} style={type.body}>🔒 {r.text} · {r.date}</Text>)}
      <GoButton href="/more/full-plan" label="See the full plan ›" />
    </> : <>
      <Text style={type.sub}>{shared ? 'Payment amounts saved on this phone' : 'Sample payments · saved on this phone'}</Text>
      <Text style={type.title}>{summary.count} payments left · {money(summary.left)}</Text>
      <Text style={type.body}>Total agreed {money(summary.total)} · Paid so far {money(summary.paid)}</Text>
      {rows.find(r=>!r.paidOn) ? <Text style={type.body}>Next: {rows.find(r=>!r.paidOn)!.payee} · {money(rows.find(r=>!r.paidOn)!.cents)} · {rows.find(r=>!r.paidOn)!.date}</Text> : null}
      {['Past due','Due in the next 30 days','Later','Paid'].map(group=> { const items=rows.filter(r=>paymentGroup(r,today)===group); return items.length ? <View key={group} style={{gap:space[2]}}><Text style={type.section}>{group} · {money(items.reduce((n,r)=>n+r.cents,0))}</Text>{items.map(r=><View key={r.id} style={{borderBottomWidth:1,borderColor:color.rule,paddingVertical:8}}>
        {button(`${r.payee} · ${money(r.cents)}`,()=>{setEditing(r);setAmount((r.cents/100).toFixed(2));})}
        <Text style={type.sub}>{r.detail} · {r.date} · {r.method || 'Payment method not set'}</Text>
        {r.paidOn ? <Text style={type.sub}>Paid {r.paidOn}</Text> : null}
        {button(r.paidOn ? 'Undo paid' : 'Mark paid',()=>{void complete(r);})}
      </View>)}</View> : null; })}
      {button('+ Add a payment',()=>{setEditing({id:`own:${Date.now()}`,payee:'',detail:'',date,cents:0,method:''});setAmount('');})}
      {editing ? <View style={{gap:12}}><Text style={type.section}>Payment details</Text>
        {field('Who is paid',editing.payee,v=>setEditing({...editing,payee:v}))}
        {!editing.id.startsWith('task:') ? field('What the payment is for',editing.detail,v=>setEditing({...editing,detail:v})) : null}
        {field('Amount in USD',amount,setAmount)}
        {!editing.id.startsWith('task:') ? <WeddingDatePicker label="Payment due date" value={editing.date} onChange={v=>setEditing({...editing,date:v})} /> : null}
        {field('How it is paid',editing.method,v=>setEditing({...editing,method:v}))}
        {button('Save payment',()=>{try {void save({...editing,cents:amountCents(amount)});} catch(e) {setError((e as Error).message);}})}
        {button('Cancel',()=>setEditing(null))}
      </View> : null}
    </>}
  </PlannedScreen>;
}
