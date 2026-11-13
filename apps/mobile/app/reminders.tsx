import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { GoButton, PlannedScreen } from '../src/ui';
import { partOfFullPlan } from '../src/build';
import { useFullPlanPrice } from '../src/useFullPlanPrice';
import { goHome } from '../src/nav';
import { color, type } from '../src/theme';
import { hasFullPlan, reminderChoice, reminderError, turnRemindersOff, turnRemindersOn } from '../src/localReminders';
import { canRemind } from '../src/reminders';
export default function Reminders() {
  const [available, setAvailable] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const price = useFullPlanPrice();
  useEffect(() => { Promise.all([hasFullPlan(), reminderChoice(), reminderError()]).then(([paid, choice, error]) => { setAvailable(canRemind(paid)); setReady(true); setMessage(error ?? (choice === 'enabled' ? 'Reminders are on.' : 'Reminders are off.')); }).catch(() => setMessage('Could not read reminder settings. Try again.')); }, []);
  async function change(enable: boolean) {
    setBusy(true);
    try { if (enable) await turnRemindersOn(); else await turnRemindersOff(); goHome(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update reminders. Try again.'); }
    finally { setBusy(false); }
  }
  const button = (label: string, onPress: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[type.button, { color: color.blue }]}>{label}</Text></Pressable>;
  return <PlannedScreen route="/reminders">
    <Text accessibilityRole="header" style={type.title}>Reminders</Text>
    <Text style={type.body}>A reminder at 9:00 on the morning each set of tasks begins, naming the ones you have not ticked.</Text>
    {!ready ? null : available ? <>
      <Text accessibilityRole="alert" style={type.sub}>{message}</Text>
      {button('Turn on reminders ›', () => change(true), busy)}
      {button('Not now ›', () => change(false), busy)}
    </> : <>
      <Text style={type.body}>{partOfFullPlan(price)}. They are off on the free plan. The free calendar file under More puts the same dates in your own calendar.</Text>
      <GoButton href="/more/full-plan" label="See the full plan ›" primary />
      {button('← Back to my plan', goHome)}
    </>}
  </PlannedScreen>;
}
