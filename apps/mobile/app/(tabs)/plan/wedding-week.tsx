import { sharingDetails } from '../../../src/sharing/details';
import { SHARED_WEEK_KEY, SHARED_PAYMENTS_KEY } from '../../../src/sharing/active';
import type { PaymentState } from '../../../src/payments';
import { taskKey } from '@core/plan-progress';
import { activePlan } from '../../../src/sharing/runtime';
import { useSharingRevision } from '../../../src/sharing/useSharing';
import type { SharedPlan } from '../../../src/sharing/session';
import { useCallback, useState } from 'react';
import { Text, TextInput, Pressable, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyProgress, toggleDone, type PlanProgress } from '@core/plan-progress';
import { PlannedScreen, GoButton } from '../../../src/ui';
import { savedDate } from '../../../src/savedDate';
import { savedProgress } from '../../../src/savedProgress';
import { hasFullPlan } from '../../../src/localReminders';
import { paymentRows, paymentsStore, SAMPLE_PAYMENTS, type Payment } from '../../../src/payments';
import { weekTasks, weekEnvelopes, weekStore, type WeekDetails, type Contact } from '../../../src/weddingWeek';
import { color, type } from '../../../src/theme';
import { plainDate } from '@core/dated-plan';
import { partOfFullPlan } from '../../../src/build';
import { useFullPlanPrice } from '../../../src/useFullPlanPrice';
const preview = process.env.EXPO_PUBLIC_DW_PREVIEW === '1';
const store = weekStore(AsyncStorage,preview);
export default function WeddingWeek() {
  const sharingRevision = useSharingRevision();
  const [shared, setShared] = useState<SharedPlan | null>(null);
  const [date,setDate] = useState(''); const [progress,setProgress] = useState<PlanProgress>(emptyProgress);
  const [details,setDetails] = useState<WeekDetails>({who:{},contacts:[]});
  const [payments,setPayments] = useState<Payment[]>([]); const [allowed,setAllowed] = useState(false);
  const [ready,setReady] = useState(false); const [busy,setBusy] = useState(false); const [error,setError] = useState('');
  const price = useFullPlanPrice();
  const [contact,setContact] = useState<Contact|null>(null); const [who,setWho] = useState<Record<string,string>>({});
  useFocusEffect(useCallback(() => { let active=true;
    Promise.all([savedDate.read(),savedProgress.read(),store.read(),activePlan(),paymentsStore(AsyncStorage,preview ? 'dw.payments.preview.v1':'dw.payments.v1').read()]).then(async ([d,p,s,paid,m])=> { if(paid) { s = await sharingDetails(AsyncStorage,SHARED_WEEK_KEY,paid.event.id,()=>({who:{},contacts:[]} as WeekDetails)).read(); m = await sharingDetails(AsyncStorage,SHARED_PAYMENTS_KEY,paid.event.id,()=>({own:[],edits:{}} as PaymentState)).read(); } return [d,p,s,paid,m] as const; }).then(([d,p,s,paid,m])=>{if(active){setDate(d??'');setProgress(p);setDetails(s);setWho(s.who);setShared(paid);setAllowed(!!paid);setPayments(paymentRows(paid?.list ?? (preview?SAMPLE_PAYMENTS:null),d??'',m.own,m.edits,!!paid||preview).map(row=>{const t=paid?.list.tasks.find(t=>row.id===`task:${t.id}`);return t?{...row,paidOn:p.done[taskKey(t.window,t.text)]?.slice(0,10)}:row;}));setReady(true);}}).catch(()=>{if(active)setError('Could not open your wedding week. Reopen to try again.');});
    return ()=>{active=false;}; },[sharingRevision]));
  async function save(next: WeekDetails) { setBusy(true); try {if(shared) await sharingDetails(AsyncStorage,SHARED_WEEK_KEY,shared.event.id,()=>({who:{},contacts:[]} as WeekDetails)).save(next); else await store.save(next);setDetails(next);setContact(null);setError('');} catch {setError('Could not save. Try again.');} finally {setBusy(false);} }
  async function tick(key:string) {setBusy(true);try {setProgress(await savedProgress.update(p=>toggleDone(p,key,new Date().toISOString())));}catch{setError('Could not save your tick. Try again.');}finally{setBusy(false);}}
  const button=(label:string,action:()=>void)=><Pressable accessibilityRole="button" disabled={busy} onPress={action} style={{minHeight:48,justifyContent:'center'}}><Text style={[type.button,{color:color.blue}]}>{label}</Text></Pressable>;
  const field=(label:string,value:string,change:(v:string)=>void)=><View><Text style={type.sub}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={change} editable={!busy} maxLength={140} style={[type.body,{borderWidth:1,borderColor:color.rule,padding:12}]} /></View>;
  const tasks=weekTasks(shared?.list ?? (preview?SAMPLE_PAYMENTS:null),date,progress,allowed||preview);
  return <PlannedScreen route="/plan/wedding-week">
    {error?<Text accessibilityRole="alert">{error}</Text>:null}
    {!ready?<Text style={type.body}>Opening your wedding week…</Text>:!date?<GoButton href="/welcome" label="Set your wedding date ›" />:!allowed&&!preview?<><Text style={type.body}>{partOfFullPlan(price)}. Your wedding week brings your final days, who to call and the payment envelopes together.</Text><GoButton href="/more/full-plan" label="See the full plan ›" /></>:<>
      {!shared?<><Text style={type.body}>Sample of a paid screen. Your wedding week is {partOfFullPlan(price, 'part')}. The tasks below are made up so you can try it.</Text><GoButton href="/more/full-plan" label="See the full plan ›" /></>:null}
      {Array.from({length:8},(_,i)=>7-i).filter(day=>tasks.some(t=>t.daysBefore===day)).map(day=><View key={day}><Text style={type.section}>{day===0?'Wedding day':day===1?'1 day before':`${day} days before`}</Text>{tasks.filter(t=>t.daysBefore===day).map(t=><View key={t.key}>
        <Pressable accessibilityRole="checkbox" accessibilityState={{checked:!!t.doneAt,disabled:busy}} disabled={busy} onPress={()=>void tick(t.key)} style={{minHeight:48}}><Text style={type.body}>{t.doneAt?'✓':'○'} {t.text}</Text></Pressable>
        <Text style={type.sub}>{t.date ? plainDate(t.date) : ''} · Suggested owner: {t.owner || 'you choose'}</Text>
        {field('Who',who[t.key]??details.who[t.key]??'',v=>setWho({...who,[t.key]:v}))}
        {button('Save who',()=>void save({...details,who:{...details.who,[t.key]:who[t.key]??''}}))}
      </View>)}</View>)}
      <Text style={type.section}>Who to call</Text>
      {details.contacts.map(c=><View key={c.id}><Text style={type.body}>{c.name} · {c.phone}</Text><Text style={type.sub}>Arrival: {c.arrival} · If late: {c.caller}</Text>{button('Edit contact',()=>setContact(c))}{button('Remove contact',()=>void save({...details,contacts:details.contacts.filter(x=>x.id!==c.id)}))}</View>)}
      {button('+ Add a contact',()=>setContact({id:String(Date.now()),name:'',phone:'',arrival:'',caller:''}))}
      {contact?<View>{(['name','phone','arrival','caller'] as const).map((key,i)=><View key={key}>{field(['Vendor name','Phone','Arrival time','Who calls if late'][i],contact[key],v=>setContact({...contact,[key]:v}))}</View>)}{button('Save contact',()=>{if(!contact.name.trim()){setError('Add a vendor name.');return;}void save({...details,contacts:[...details.contacts.filter(c=>c.id!==contact.id),contact]});})}{button('Cancel',()=>setContact(null))}</View>:null}
      <Text style={type.section}>Envelopes</Text>
      {weekEnvelopes(payments,date,allowed||preview).map(p=><Text key={p.id} style={type.body}>{p.payee} · {p.cents ? new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(p.cents/100) : 'amount not added yet'} · {plainDate(p.date)} · {p.paidOn?'Paid':'Not paid yet'}</Text>)}
      <GoButton href="/payments" label="Edit payments ›" />
    </>}
  </PlannedScreen>;
}
