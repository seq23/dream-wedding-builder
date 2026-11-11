import { useCallback, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { emptyProgress } from '@core/plan-progress';
import { GoButton, PlannedScreen } from '../../../src/ui';
import { savedDate } from '../../../src/savedDate';
import { savedProgress } from '../../../src/savedProgress';
import { reminderChoice, stopPlanReminders } from '../../../src/localReminders';
import { deleteLocalPlan } from '../../../src/deletePlan';
import { color, space, type } from '../../../src/theme';

export default function More() {
  const [date, setDate] = useState<string | null>(null);
  const [reminders, setReminders] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([savedDate.read(), reminderChoice()]).then(([d, choice]) => {
      if (active) { setDate(d); setReminders(choice === 'enabled' ? 'On' : 'Off'); }
    }).catch(() => { if (active) setError('Could not read your settings. Reopen this screen to try again.'); });
    return () => { active = false; };
  }, []));
  async function remove() {
    setBusy(true); setError('');
    try {
      await deleteLocalPlan(AsyncStorage, stopPlanReminders, () => savedProgress.update(() => emptyProgress()));
      router.replace('/welcome');
    } catch { setError('Deletion could not finish. Please try again.'); }
    finally { setBusy(false); }
  }
  const button = (label: string, action: () => void) => <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} onPress={action} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[type.button, { color: color.blue }]}>{label}</Text></Pressable>;
  async function open(path: string) {
    try { await Linking.openURL(`https://www.weddingchecklistpdf.com/${path}`); }
    catch { setError('Could not open the page. Please try again.'); }
  }
  return <PlannedScreen route="/more" implemented>
    {error ? <Text accessibilityRole="alert" style={{ color: color.redPen }}>{error}</Text> : null}
    {busy ? <Text style={type.body}>Deleting your plan…</Text> : <>
      <Text style={type.body}>Wedding date: {date ? new Date(`${date}T12:00:00`).toLocaleDateString() : 'Not set yet'}</Text>
      <GoButton href="/welcome" label="Change the wedding date ›" />
      <Text style={type.sub}>Reminders: {reminders}</Text>
      <GoButton href="/reminders" label="Reminders ›" />
      <GoButton href="/more/full-plan" label="The full plan ›" />
      {button('Privacy policy ›', () => { void open('privacy'); })}
      {button('Terms ›', () => { void open('terms'); })}
      {confirm ? <View style={{ gap: space[3], borderWidth: 1, borderColor: color.rule, padding: space[4] }}>
        <Text accessibilityRole="header" style={type.section}>Delete this plan from this phone?</Text>
        <Text style={type.body}>This removes the date, task ticks, your own tasks, tradition tasks and saved payments from this phone, and turns off its reminders. It cannot be undone. Purchases are kept. Copies on other phones stay there.</Text>
        {button('Keep my plan', () => setConfirm(false))}
        {button('Yes, delete from this phone', () => { void remove(); })}
      </View> : button('Delete my plan from this phone', () => setConfirm(true))}
    </>}
  </PlannedScreen>;
}
