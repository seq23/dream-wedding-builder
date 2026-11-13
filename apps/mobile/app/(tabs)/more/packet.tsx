import { sharingDetails } from '../../../src/sharing/details';
import { SHARED_WEEK_KEY, SHARED_PAYMENTS_KEY } from '../../../src/sharing/active';
import type { PaymentState } from '../../../src/payments';
import { activePlan } from '../../../src/sharing/runtime';
import { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlannedScreen } from '../../../src/ui';
import { savedDate } from '../../../src/savedDate';
import { savedProgress } from '../../../src/savedProgress';
import { paymentsStore, SAMPLE_PAYMENTS } from '../../../src/payments';
import { type Paper, type PacketInput, type PacketWeek } from '../../../src/packet';
import { preparePacketOutput } from '../../../src/packetOutput';
import { color, space, type } from '../../../src/theme';
const preview = process.env.EXPO_PUBLIC_DW_PREVIEW === '1';
import { partOfFullPlan } from '../../../src/build';
import { useFullPlanPrice } from '../../../src/useFullPlanPrice';

export default function Packet() {
  const [paper, setPaper] = useState<Paper>('Letter');
  const [names, setNames] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const price = useFullPlanPrice();
  async function send() {
    setBusy(true); setError('');
    let output: ReturnType<typeof preparePacketOutput> | undefined;
    try {
      output = preparePacketOutput();
      const [date, progress, payments, rawWeek, shared] = await Promise.all([
        savedDate.read(), savedProgress.read(),
        paymentsStore(AsyncStorage, preview ? 'dw.payments.preview.v1' : 'dw.payments.v1').read(),
        AsyncStorage.getItem(preview ? 'dw.week.preview.v1' : 'dw.week.v1'), activePlan(),
      ]);
      let week: PacketWeek = rawWeek ? JSON.parse(rawWeek) : { who: {}, contacts: [] };
      const localPayments = shared ? await sharingDetails(AsyncStorage,SHARED_PAYMENTS_KEY,shared.event.id,()=>({own:[],edits:{}} as PaymentState)).read() : payments;
      if (shared) week = await sharingDetails(AsyncStorage,SHARED_WEEK_KEY,shared.event.id,()=>({who:{},contacts:[]} as PacketWeek)).read();
      // The verified purchase door is closed. Only the isolated preview gets fictional data.
      const input: PacketInput = { shared: !!shared, names, date: date ?? '', progress, payments: localPayments, week, unlocked: !!shared || preview, list: shared?.list ?? (preview ? SAMPLE_PAYMENTS : null) };
      await output.write(input, paper);
    } catch (e) { output?.cancel(); setError(e instanceof Error ? e.message : 'Could not prepare your plan. Try again.'); }
    finally { setBusy(false); }
  }
  return <PlannedScreen route="/more/packet">
    <Text accessibilityRole="header" style={type.title}>A copy to print or send</Text>
    <Text style={type.body}>Free: your dated tasks and the tasks you added, on paper or as a PDF.</Text>
    <Text style={type.sub}>{partOfFullPlan(price)}: payments, your wedding week and vendor contacts on the same copy.</Text>
    {preview ? <Text style={type.sub}>Sample: this preview prints the full-plan copy, with made-up payments, so you can see it.</Text> : null}
    <Text style={type.sub}>Made on this device. Nothing is uploaded. Choose who receives it in the share sheet.</Text>
    <Text style={type.body}>Names on the packet (optional)</Text>
    <TextInput accessibilityLabel="Names on the packet (optional)" maxLength={140} value={names} onChangeText={setNames} editable={!busy} style={[type.body,{ borderWidth: 1, borderColor: color.rule, padding: space[3] }]} />
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: space[4] }}>
      {(['Letter','A4'] as Paper[]).map(p => <Pressable key={p} accessibilityRole="radio" accessibilityState={{ checked: paper === p, disabled: busy }} disabled={busy} onPress={() => setPaper(p)} style={{ minHeight:48, justifyContent:'center' }}><Text style={type.button}>{paper === p ? '●' : '○'} {p}</Text></Pressable>)}
    </View>
    {Platform.OS === 'web' ? <Text style={type.sub}>Your browser opens printing. Choose Save as PDF to keep a file, and match the paper size above.</Text> : null}
    {error ? <Text accessibilityRole="alert" style={{color:color.redPen}}>{error}</Text> : null}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => { void send(); }} style={{ minHeight:48, alignItems:'center', justifyContent:'center', backgroundColor:color.blue, opacity:busy ? 0.5 : 1 }}><Text style={[type.button,{color:color.onBlue}]}>{busy ? 'Preparing your copy…' : 'Print or send ›'}</Text></Pressable>
  </PlannedScreen>;
}
