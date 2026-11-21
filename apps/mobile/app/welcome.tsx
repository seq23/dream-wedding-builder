import { useEffect, useState } from 'react';
import { Text, View, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { GoButton, PlannedScreen } from '../src/ui';
import { WeddingDatePicker } from '../src/WeddingDatePicker';
import { savedDate } from '../src/savedDate';
import { savedProgress } from '../src/savedProgress';
import { loadSamplePlan } from '../src/previewPlan';
import { canSaveDate, clearNeedsConfirm, dateCheck, startingDate } from '../src/welcomeStart';
import { plainDate } from '@core/dated-plan';
import { PREVIEW } from '../src/build';
import { color, type, space } from '../src/theme';
export default function Welcome() {
  // "from=more": she came from More, so a way back there makes sense; on first launch it does not.
  const { from } = useLocalSearchParams<{ from?: string }>();
  // Empty for someone new; her saved date when she came back to change it.
  const [date, setDate] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  const [error, setError] = useState('');
  const [ask, setAsk] = useState<'past' | 'clear' | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { savedDate.read().then(s => { setSaved(s); setReturning(s !== null); setDate(current => current || startingDate(s)); }).catch(() => {}); }, []);
  async function save(value: string, confirmed = false) {
    // A date in the past is usually a typo in the year; clearing a saved date loses it. Both ask first.
    if (!confirmed && value && dateCheck(value) === 'past') { setAsk('past'); return; }
    if (!confirmed && !value && clearNeedsConfirm(saved)) { setAsk('clear'); return; }
    setBusy(true); setError(''); setAsk(null);
    try { await savedDate.save(value, undefined, true); router.replace('/plan'); }
    catch (e) { setError(e instanceof Error && e.message === 'INVALID_DATE' ? 'An unlocked event needs a wedding date.' : e instanceof Error ? e.message : 'Could not save. Please try again.'); }
    finally { setBusy(false); }
  }
  async function openSample() {
    setBusy(true); setError('');
    try { await loadSamplePlan(PREVIEW, savedDate, savedProgress); router.replace('/plan'); }
    catch { setError('Could not load the sample. Please try again.'); }
    finally { setBusy(false); }
  }
  const ready = canSaveDate(date) && !busy;
  const link = (label: string, onPress: () => void) => <Pressable accessibilityRole="button" disabled={busy} onPress={onPress} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[type.button, { color: color.blue }]}>{label}</Text></Pressable>;
  return <PlannedScreen route="/welcome"><View style={{ flex: 1, padding: space[5], paddingTop: 64, gap: space[4], backgroundColor: color.ivory }}>
    <Text accessibilityRole="header" style={type.title}>When is your wedding?</Text>
    {returning
      ? <Text style={type.body}>Change the date and every task moves with it. Postponed? Change it as often as you need, at no charge.</Text>
      : <><Text style={type.section}>No account, no vendor ads, and we never sell your plan.</Text><Text style={type.body}>Dream Wedding turns your wedding date into a checklist with a real date on every task. The checklist, your own tasks and a printable copy are free.</Text></>}
    <WeddingDatePicker value={date} onChange={value => { setDate(value); setAsk(null); }} />
    {ask === 'past' ? <View accessibilityRole="alert" style={{ gap: space[2], borderWidth: 1, borderColor: color.rule, padding: space[3] }}>
      <Text style={type.section}>Is that right?</Text>
      <Text style={type.body}>{plainDate(date)} has already passed. If you meant next year, change the year.</Text>
      {link('Yes, that’s right ›', () => { void save(date, true); })}
      {link('Change the date', () => setAsk(null))}
    </View> : null}
    {ask === 'clear' ? <View accessibilityRole="alert" style={{ gap: space[2], borderWidth: 1, borderColor: color.rule, padding: space[3] }}>
      <Text style={type.section}>Clear your date?</Text>
      <Text style={type.body}>Your tasks lose their dates until you add one again. Your ticks and your own tasks stay.</Text>
      {link('Yes, clear my date', () => { void save('', true); })}
      {link(`Keep ${saved ? plainDate(saved) : 'my date'}`, () => setAsk(null))}
    </View> : null}
    {error ? <><Text accessibilityRole="alert" style={[type.body, { color: color.redPen }]}>{error}</Text>{from === 'more' ? <GoButton href="/more" label="Back to More ›" /> : null}</> : null}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ready }} disabled={!ready} onPress={() => save(date)} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: color.blue, borderRadius: 10, opacity: ready ? 1 : 0.5 }}><Text style={[type.button, { color: color.onBlue }]}>{returning ? 'Save this date ›' : 'Start my free plan ›'}</Text></Pressable>
    {!canSaveDate(date) ? <Text style={type.sub}>Choose your date above to start.</Text> : null}
    {link('I don’t have a date yet ›', () => { void save(''); })}
    {PREVIEW ? <Pressable accessibilityRole="button" disabled={busy} onPress={openSample} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={type.sub}>Preview only: open a sample plan ›</Text></Pressable> : null}
  </View></PlannedScreen>;
}
