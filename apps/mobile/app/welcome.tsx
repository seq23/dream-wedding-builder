import { useEffect, useState } from 'react';
import { Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { GoButton, PlannedScreen } from '../src/ui';
import { WeddingDatePicker } from '../src/WeddingDatePicker';
import { savedDate } from '../src/savedDate';
import { savedProgress } from '../src/savedProgress';
import { loadSamplePlan } from '../src/previewPlan';
import { canSaveDate, startingDate } from '../src/welcomeStart';
import { PREVIEW } from '../src/build';
import { color, type, space } from '../src/theme';
export default function Welcome() {
  // Empty for someone new; her saved date when she came back to change it.
  const [date, setDate] = useState('');
  const [returning, setReturning] = useState(false);
  const [error, setError] = useState('');
  const [needsNewEvent, setNeedsNewEvent] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { savedDate.read().then(saved => { setReturning(saved !== null); setDate(current => current || startingDate(saved)); }).catch(() => {}); }, []);
  async function save(value: string) {
    setBusy(true); setError(''); setNeedsNewEvent(false);
    try { await savedDate.save(value); router.replace('/plan'); }
    catch (e) { setNeedsNewEvent(e instanceof Error && e.message === 'NEW_EVENT_REQUIRED'); setError(e instanceof Error && e.message === 'NEW_EVENT_REQUIRED' ? 'This event has used its three date changes. A different date needs a new event.' : e instanceof Error && e.message === 'INVALID_DATE' ? 'An unlocked event needs a wedding date.' : e instanceof Error ? e.message : 'Could not save. Please try again.'); }
    finally { setBusy(false); }
  }
  async function openSample() {
    setBusy(true); setError('');
    try { await loadSamplePlan(PREVIEW, savedDate, savedProgress); router.replace('/plan'); }
    catch { setError('Could not load the sample. Please try again.'); }
    finally { setBusy(false); }
  }
  const ready = canSaveDate(date) && !busy;
  return <PlannedScreen route="/welcome"><View style={{ flex: 1, padding: space[5], paddingTop: 64, gap: space[4], backgroundColor: color.ivory }}>
    <Text accessibilityRole="header" style={type.title}>When is your wedding?</Text>
    {returning
      ? <Text style={type.body}>Change the date and every task moves with it.</Text>
      : <Text style={type.body}>Dream Wedding turns your wedding date into a checklist with a real date on every task. The checklist, your own tasks and a printable copy are free, with no account.</Text>}
    <WeddingDatePicker value={date} onChange={setDate} />
    {error ? <><Text accessibilityRole="alert" style={[type.body, { color: color.redPen }]}>{error}</Text>{needsNewEvent ? <GoButton href={`/more/full-plan?newEvent=1&date=${encodeURIComponent(date)}`} label="Start a new event ›" /> : null}<GoButton href="/more" label="Back to More ›" /></> : null}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ready }} disabled={!ready} onPress={() => save(date)} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: color.blue, borderRadius: 10, opacity: ready ? 1 : 0.5 }}><Text style={[type.button, { color: color.onBlue }]}>{returning ? 'Save this date ›' : 'Start my free plan ›'}</Text></Pressable>
    {!canSaveDate(date) ? <Text style={type.sub}>Choose your date above to start.</Text> : null}
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => save('')} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[type.button, { color: color.blue }]}>I don’t have a date yet ›</Text></Pressable>
    {PREVIEW ? <Pressable accessibilityRole="button" disabled={busy} onPress={openSample} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={type.sub}>Preview only: open a sample plan ›</Text></Pressable> : null}
  </View></PlannedScreen>;
}
