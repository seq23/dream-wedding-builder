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
const preview = process.env.EXPO_PUBLIC_DW_PREVIEW === '1';
const store = weekStore(AsyncStorage,preview);
export default function WeddingWeek() {
  const [date,setDate] = useState(''); const [progress,setProgress] = useState<PlanProgress>(emptyProgress);
  const [details,setDetails] = useState<WeekDetails>({who:{},contacts:[]});
  const [payments,setPayments] = useState<Payment[]>([]); const [allowed,setAllowed] = useState(false);
  const [ready,setReady] = useState(false); const [busy,setBusy] = useState(false); const [error,setError] = useState('');
  const [contact,setContact] = useState<Contact|null>(null); const [who,setWho] = useState<Record<string,string>>({});
  useFocusEffect(useCallback(() => { let active=true;
    Promise.all([savedDate.read(),savedProgress.read(),store.read(),hasFullPlan(),paymentsStore(AsyncStorage,preview ? 'dw.payments.preview.v1':'dw.payments.v1').read()]).then(([d,p,s,paid,m])=>{if(active){setDate(d??'');setProgress(p);setDetails(s);setWho(s.who);setAllowed(paid);setPayments(paymentRows(preview?SAMPLE_PAYMENTS:null,d??'',m.own,m.edits,preview));setReady(true);}}).catch(()=>{if(active)setError('Could not open your wedding week. Reopen to try again.');});
    return ()=>{active=false;}; },[]));
  async function save(next: WeekDetails) { setBusy(true); try {await store.save(next);setDetails(next);setContact(null);setError('');} catch {setError('Could not save. Try again.');} finally {setBusy(false);} }
  async function tick(key:string) {setBusy(true);try {setProgress(await savedProgress.update(p=>toggleDone(p,key,new Date().toISOString())));}catch{setError('Could not save your tick. Try again.');}finally{setBusy(false);}}
  const button=(label:string,action:()=>void)=><Pressable accessibilityRole="button" disabled={busy} onPress={action} style={{minHeight:48,justifyContent:'center'}}><Text style={[type.button,{color:color.blue}]}>{label}</Text></Pressable>;
  const field=(label:string,value:string,change:(v:string)=>void)=><View><Text style={type.sub}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={change} editable={!busy} maxLength={140} style={[type.body,{borderWidth:1,borderColor:color.rule,padding:12}]} /></View>;
  const tasks=weekTasks(preview?SAMPLE_PAYMENTS:null,date,progress,allowed||preview);
  return <PlannedScreen route="/plan/wedding-week" implemented>
    {error?<Text accessibilityRole="alert">{error}</Text>:null}
    {!ready?<Text style={type.body}>Opening your wedding week…</Text>:!date?<GoButton href="/welcome" label="Set your wedding date ›" />:!allowed&&!preview?<><Text style={type.body}>The full plan brings your final days, who to call and payment envelopes together.</Text><GoButton href="/more/full-plan" label="See the full plan ›" /></>:<>
      {preview?<Text style={type.sub}>Sample wedding week · saved on this phone</Text>:null}
      {Array.from({length:8},(_,i)=>7-i).map(day=><View key={day}><Text style={type.section}>{day?`${day} days before`:'Wedding day'}</Text>{tasks.filter(t=>t.daysBefore===day).map(t=><View key={t.key}>
        <Pressable accessibilityRole="checkbox" accessibilityState={{checked:!!t.doneAt,disabled:busy}} disabled={busy} onPress={()=>void tick(t.key)} style={{minHeight:48}}><Text style={type.body}>{t.doneAt?'✓':'○'} {t.text}</Text></Pressable>
        <Text style={type.sub}>{t.date} · Suggested owner: {t.owner || 'You choose'}</Text>
        {field('Who',who[t.key]??details.who[t.key]??'',v=>setWho({...who,[t.key]:v}))}
        {button('Save who',()=>void save({...details,who:{...details.who,[t.key]:who[t.key]??''}}))}
      </View>)}</View>)}
      <Text style={type.section}>Who to call</Text>
      {details.contacts.map(c=><View key={c.id}><Text style={type.body}>{c.name} · {c.phone}</Text><Text style={type.sub}>Arrival: {c.arrival} · If late: {c.caller}</Text>{button('Edit contact',()=>setContact(c))}{button('Remove contact',()=>void save({...details,contacts:details.contacts.filter(x=>x.id!==c.id)}))}</View>)}
      {button('+ Add a contact',()=>setContact({id:String(Date.now()),name:'',phone:'',arrival:'',caller:''}))}
      {contact?<View>{(['name','phone','arrival','caller'] as const).map((key,i)=><View key={key}>{field(['Vendor name','Phone','Arrival time','Who calls if late'][i],contact[key],v=>setContact({...contact,[key]:v}))}</View>)}{button('Save contact',()=>{if(!contact.name.trim()){setError('Add a vendor name.');return;}void save({...details,contacts:[...details.contacts.filter(c=>c.id!==contact.id),contact]});})}{button('Cancel',()=>setContact(null))}</View>:null}
      <Text style={type.section}>Envelopes</Text>
      {weekEnvelopes(payments,date,allowed||preview).map(p=><Text key={p.id} style={type.body}>{p.payee} · {new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(p.cents/100)} · {p.date} · {p.method || 'Method not set'} · {p.paidOn?'Paid':'Unpaid'}</Text>)}
      <GoButton href="/payments" label="Edit payments ›" />
    </>}
  </PlannedScreen>;
}
