import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { PlannedScreen } from '../src/ui';
import { goHome } from '../src/nav';
import { color, type } from '../src/theme';
import { hasFullPlan, reminderChoice, reminderError, turnRemindersOff, turnRemindersOn } from '../src/localReminders';
import { canRemind } from '../src/reminders';
export default function Reminders() {
  const [available, setAvailable] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { Promise.all([hasFullPlan(), reminderChoice(), reminderError()]).then(([paid, choice, error]) => { setAvailable(canRemind(paid)); setMessage(error ?? (choice === 'enabled' ? 'Reminders are on.' : 'Reminders are off.')); }).catch(() => setMessage('Could not read reminder settings. Try again.')); }, []);
  async function change(enable: boolean) {
    setBusy(true);
    try { if (enable) await turnRemindersOn(); else await turnRemindersOff(); goHome(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not update reminders. Try again.'); }
    finally { setBusy(false); }
  }
  const button = (label: string, onPress: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[type.button, { color: color.blue }]}>{label}</Text></Pressable>;
  return <PlannedScreen route="/reminders" implemented>
    <Text style={type.body}>The full plan adds payments, the wedding-week sheet and the hand-over packet. Local reminders are included: at 9:00 when a future planning window starts, with your unfinished tasks.</Text>
    {!available ? <Text style={type.body}>Purchases are not set up yet. Reminders stay off.</Text> : null}
    <Text accessibilityRole="alert" style={type.sub}>{message}</Text>
    {button('Turn on reminders', () => change(true), busy || !available)}
    {button('Not now', () => change(false), busy)}
  </PlannedScreen>;
}
