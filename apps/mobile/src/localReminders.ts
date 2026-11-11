import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { parseProgress } from '@core/plan-progress';
import { canRemind, reminderSchedule, replaceReminders, type ReminderChoice, type ReminderDriver } from './reminders';

const CHOICE = 'dw.reminders.choice.v1';
const ERROR = 'dw.reminders.error.v1';
// Task 8 replaces this with the verified current event entitlement. Never trust a preview flag.
export async function hasFullPlan() { return false; }
export async function reminderChoice(): Promise<ReminderChoice> {
  const choice = await AsyncStorage.getItem(CHOICE);
  return choice === 'enabled' || choice === 'off' ? choice : 'unasked';
}
export const reminderError = () => AsyncStorage.getItem(ERROR);
async function nativeDriver(): Promise<ReminderDriver> {
  const n = await import('expo-notifications');
  if (Platform.OS === 'android') await n.setNotificationChannelAsync('wedding-plan', { name: 'Wedding plan', importance: n.AndroidImportance.DEFAULT });
  return {
    cancel: async () => { for (const item of await n.getAllScheduledNotificationsAsync()) if (item.identifier.startsWith('dw-')) await n.cancelScheduledNotificationAsync(item.identifier); },
    allowed: async () => (await n.getPermissionsAsync()).granted,
    schedule: async r => { await n.scheduleNotificationAsync({ identifier: r.id, content: { title: r.title, body: r.body }, trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: 'wedding-plan' } }); },
  };
}
let queue: Promise<void> = Promise.resolve();
export function syncReminders(): Promise<void> {
  const job = queue.then(async () => {
    if (Platform.OS === 'web') return;
    const [date, raw, choice, fullPlan] = await Promise.all([AsyncStorage.getItem('dw.wedding-date.v1'), AsyncStorage.getItem('dw-plan-progress'), reminderChoice(), hasFullPlan()]);
    await replaceReminders(await nativeDriver(), reminderSchedule(date ?? '', parseProgress(raw), new Date(), fullPlan), choice === 'enabled');
    await AsyncStorage.removeItem(ERROR);
  }).catch(async () => { await AsyncStorage.setItem(ERROR, 'Your plan is saved, but reminders could not be updated. Open Reminders to try again.'); });
  queue = job;
  return job;
}
export async function turnRemindersOff() { await AsyncStorage.setItem(CHOICE, 'off'); await syncReminders(); }
export async function turnRemindersOn() {
  if (!canRemind(await hasFullPlan())) throw Error('Reminders are part of the full plan. Purchases are not set up yet.');
  if (Platform.OS === 'web') throw Error('Local reminders need the phone app.');
  // Save the decision before asking the OS, so a refused permission never re-prompts automatically.
  await AsyncStorage.setItem(CHOICE, 'off');
  await nativeDriver();
  const n = await import('expo-notifications');
  const permission = await n.requestPermissionsAsync();
  if (!permission.granted) throw Error('Reminders are off. You can allow notifications in your phone settings, then try again here.');
  await AsyncStorage.setItem(CHOICE, 'enabled');
  await syncReminders();
}
