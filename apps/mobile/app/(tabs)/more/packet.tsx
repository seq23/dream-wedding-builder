import { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { PlannedScreen } from '../../../src/ui';
import { savedDate } from '../../../src/savedDate';
import { savedProgress } from '../../../src/savedProgress';
import { paymentsStore, SAMPLE_PAYMENTS } from '../../../src/payments';
import { packetHtml, sharePacket, type Paper, type PacketInput, type PacketWeek } from '../../../src/packet';
import { color, space, type } from '../../../src/theme';
const preview = process.env.EXPO_PUBLIC_DW_PREVIEW === '1';

export default function Packet() {
  const [paper, setPaper] = useState<Paper>('Letter');
  const [names, setNames] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function send() {
    setBusy(true); setError('');
    try {
      const [date, progress, payments, rawWeek] = await Promise.all([
        savedDate.read(), savedProgress.read(),
        paymentsStore(AsyncStorage, preview ? 'dw.payments.preview.v1' : 'dw.payments.v1').read(),
        AsyncStorage.getItem(preview ? 'dw.week.preview.v1' : 'dw.week.v1'),
      ]);
      const week: PacketWeek = rawWeek ? JSON.parse(rawWeek) : { who: {}, contacts: [] };
      // The verified purchase door is closed. Only the isolated preview gets fictional data.
      const input: PacketInput = { names, date: date ?? '', progress, payments, week, unlocked: preview, list: preview ? SAMPLE_PAYMENTS : null };
      if (Platform.OS === 'web') {
        await Print.printAsync({ html: packetHtml(input, paper) });
      } else {
        if (!await Sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this phone. Try again when sharing is available.');
        await sharePacket(input, paper, { print: Print.printToFileAsync, share: uri => Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Print or send my plan' }) });
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not prepare your plan. Try again.'); }
    finally { setBusy(false); }
  }
  return <PlannedScreen route="/more/packet" implemented>
    <Text accessibilityRole="header" style={type.title}>Print or send my plan</Text>
    <Text style={type.body}>{preview ? 'Sample full packet with fictional payment tasks.' : 'Your basic packet includes your free tasks and the tasks you have added. The full plan adds payments, wedding week and contacts.'}</Text>
    <Text style={type.sub}>Made on this device. Nothing is uploaded. Choose who receives it in the share sheet.</Text>
    <Text style={type.body}>Names on the packet (optional)</Text>
    <TextInput accessibilityLabel="Names on the packet (optional)" maxLength={140} value={names} onChangeText={setNames} editable={!busy} style={[type.body,{ borderWidth: 1, borderColor: color.rule, padding: space[3] }]} />
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: space[4] }}>
      {(['Letter','A4'] as Paper[]).map(p => <Pressable key={p} accessibilityRole="radio" accessibilityState={{ checked: paper === p, disabled: busy }} disabled={busy} onPress={() => setPaper(p)} style={{ minHeight:48, justifyContent:'center' }}><Text style={type.button}>{paper === p ? '●' : '○'} {p}</Text></Pressable>)}
    </View>
    {Platform.OS === 'web' ? <Text style={type.sub}>Your browser opens printing. Choose Save as PDF to keep a file, and match the paper size above.</Text> : null}
    {error ? <Text accessibilityRole="alert" style={{color:color.redPen}}>{error}</Text> : null}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => { void send(); }} style={{ minHeight:48, alignItems:'center', justifyContent:'center', backgroundColor:color.blue, opacity:busy ? 0.5 : 1 }}><Text style={[type.button,{color:color.onBlue}]}>{busy ? 'Preparing your plan…' : 'Print or send my plan'}</Text></Pressable>
  </PlannedScreen>;
}
