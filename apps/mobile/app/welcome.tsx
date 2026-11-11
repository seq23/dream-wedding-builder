import { useState } from 'react';
import { Text, TextInput, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { PlannedScreen } from '../src/ui';
import { savedDate } from '../src/savedDate';
import { savedProgress } from '../src/savedProgress';
import { loadSamplePlan } from '../src/previewPlan';
import { color, type, space } from '../src/theme';
export default function Welcome() {
  const [date, setDate] = useState('');
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
    <Text nativeID="date-label" style={type.body}>Wedding date (YYYY-MM-DD)</Text>
    <TextInput accessibilityLabel="Wedding date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2028-02-29" autoCapitalize="none" style={{ minHeight: 48, borderWidth: 1, borderColor: color.rule, padding: space[3] }} />
    {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    <Pressable accessibilityRole="button" disabled={busy || !date} onPress={() => save(date)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={type.button}>Save and see my plan ›</Text></Pressable>
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => save('')} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={type.button}>Not set yet ›</Text></Pressable>
    {process.env.EXPO_PUBLIC_DW_PREVIEW === '1' ? <Pressable accessibilityRole="button" disabled={busy} onPress={openSample} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={type.button}>Preview only: open a sample plan ›</Text></Pressable> : null}
  </View></PlannedScreen>;
}
