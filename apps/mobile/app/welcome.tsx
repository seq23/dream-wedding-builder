import { useState } from 'react';
import { Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { PlannedScreen } from '../src/ui';
import { WeddingDatePicker } from '../src/WeddingDatePicker';
import { savedDate } from '../src/savedDate';
import { savedProgress } from '../src/savedProgress';
import { loadSamplePlan } from '../src/previewPlan';
import { color, type, space } from '../src/theme';
export default function Welcome() {
  const [date, setDate] = useState(() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(value: string) {
    setBusy(true); setError('');
    try { await savedDate.save(value); router.replace('/plan'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Please try again.'); }
    finally { setBusy(false); }
  }
  async function openSample() {
    setBusy(true); setError('');
    try { await loadSamplePlan(process.env.EXPO_PUBLIC_DW_PREVIEW === '1', savedDate, savedProgress); router.replace('/plan'); }
    catch { setError('Could not load the sample. Please try again.'); }
    finally { setBusy(false); }
  }
  return <PlannedScreen route="/welcome" implemented><View style={{ flex: 1, padding: space[5], paddingTop: 64, gap: space[4], backgroundColor: color.ivory }}>
    <Text accessibilityRole="header" style={type.title}>When is your wedding?</Text>
    <Text style={type.body}>Your date builds your dated wedding plan.</Text>
    <WeddingDatePicker value={date} onChange={setDate} />
    {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    <Pressable accessibilityRole="button" disabled={busy || !date} onPress={() => save(date)} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: color.blue, borderRadius: 10, opacity: busy ? 0.5 : 1 }}><Text style={[type.button, { color: color.onBlue }]}>Save and see my plan</Text></Pressable>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => save('')} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={type.sub}>Not set yet</Text></Pressable>
    {process.env.EXPO_PUBLIC_DW_PREVIEW === '1' ? <Pressable accessibilityRole="button" disabled={busy} onPress={openSample} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[type.sub, { fontSize: 11 }]}>Preview only: open a sample plan ›</Text></Pressable> : null}
  </View></PlannedScreen>;
}
