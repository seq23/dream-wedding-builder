import { phoneSharing, pauseSharing, activePlan } from '../../../src/sharing/runtime';
import { sharingDeadline } from '../../../src/sharing/deadline';
import { useSharingRevision } from '../../../src/sharing/useSharing';
import release from '../../../release/config.json';
import { useCallback, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { emptyProgress } from '@core/plan-progress';
import { GoButton, PlannedScreen } from '../../../src/ui';
import { savedDate } from '../../../src/savedDate';
import { savedProgress } from '../../../src/savedProgress';
import { reminderChoice, stopPlanReminders } from '../../../src/localReminders';
import { phoneArchives } from '../../../src/billing/archiveFiles';
import { deleteLocalPlan } from '../../../src/deletePlan';
import { downloadStore } from '../../../src/billing/downloadStore';
import { openPurchasedFile, purchasedFiles, FILE_MISSING_MESSAGE, type PurchasedFile } from '../../../src/billing/purchasedFiles';
import { eventStore } from '../../../src/billing/eventStore';
import type { PaidEvent } from '../../../src/billing/events';
import { calendarFile } from '../../../src/calendar';
import { saveCalendar } from '../../../src/calendarOutput';
import { color, space, type } from '../../../src/theme';
import { partOfFullPlan } from '../../../src/build';
import { useFullPlanPrice } from '../../../src/useFullPlanPrice';
import { plainDate } from '@core/dated-plan';

export default function More() {
  const sharingRevision = useSharingRevision();
  const [sharing, setSharing] = useState(false);
  const [sharedName, setSharedName] = useState('');
  const [joined, setJoined] = useState(false);
  const [event, setEvent] = useState<PaidEvent | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [reminders, setReminders] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const price = useFullPlanPrice();
  const paid = sharing || !!event?.fullPlan;
  const [exporting, setExporting] = useState(false);
  const [files, setFiles] = useState<{ ready: PurchasedFile[]; missing: boolean }>({ ready: [], missing: false });
  async function openFile(file: PurchasedFile) {
    setError('');
    try { await openPurchasedFile(phoneArchives, file); }
    catch (e) { setError(e instanceof Error ? e.message : FILE_MISSING_MESSAGE); }
  }
  async function calendar() {
    if (exporting) return;
    setExporting(true); setError('');
    try {
      const [date, progress] = await Promise.all([savedDate.read(), savedProgress.read()]);
      await saveCalendar(calendarFile(date, progress));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save your calendar. Please try again.'); }
    finally { setExporting(false); }
  }
  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([savedDate.read(), reminderChoice(), eventStore(AsyncStorage).active(), activePlan(), phoneSharing().then(api => api.read()), eventStore(AsyncStorage).read(), downloadStore(AsyncStorage).saved().catch(() => null)]).then(([d, choice, current, shared, session, ledger, content]) => {
      if (active) { setFiles(purchasedFiles(ledger, content)); setSharing(!!shared); setSharedName(shared?.event.name ?? ''); setJoined(session?.role === 'joined'); setDate(d); setEvent(current); setReminders(choice === 'enabled' ? 'On' : 'Off'); }
    }).catch(() => { if (active) setError('Could not read your settings. Reopen this screen to try again.'); });
    return () => { active = false; };
  }, [sharingRevision]));
  async function remove() {
    setBusy(true); setError('');
    let resume: (() => void) | undefined;
    try {
      resume = await pauseSharing();
      await deleteLocalPlan(AsyncStorage, stopPlanReminders, savedProgress.drain, () => phoneArchives.clear(), async () => {
        const api = await phoneSharing();
        if ((await api.read())?.role === 'owner') await sharingDeadline(() => api.stop(), 5000);
      });
      router.replace('/welcome');
    } catch { setError('Deletion could not finish. Please try again.'); }
    finally { resume?.(); setBusy(false); }
  }
  const button = (label: string, action: () => void) => <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} onPress={action} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[type.button, { color: color.blue }]}>{label}</Text></Pressable>;
  async function open(path: string) {
    try { await Linking.openURL(path === 'privacy' ? release.privacyUrl : release.termsUrl); }
    catch { setError('Could not open the page. Please try again.'); }
  }
  return <PlannedScreen route="/more">
    {error ? <Text accessibilityRole="alert" style={{ color: color.redPen }}>{error}</Text> : null}
    {busy ? <Text style={type.body}>Deleting your plan…</Text> : <>
      <Text style={type.body}>{date ? `Wedding date: ${plainDate(date)}` : 'You have not chosen a wedding date yet.'}</Text>
      {sharedName || event?.fullPlan ? <Text style={type.body}>🔒 {sharedName || event?.name}</Text> : null}
      {!joined && event?.fullPlan ? <Text style={type.sub}>{3 - event.dateChanges} date changes left for this event</Text> : null}
      {joined ? <Text style={type.sub}>Your partner manages the shared wedding date.</Text> : <GoButton href="/welcome" label={date ? 'Change the wedding date ›' : 'Choose my wedding date ›'} />}
      <GoButton href="/more/packet" label="Print or send my plan ›" />
      <Pressable accessibilityRole="button" disabled={exporting} accessibilityState={{ disabled: exporting }} onPress={() => { void calendar(); }} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[type.button, { color: color.blue }]}>{exporting ? 'Preparing calendar…' : 'Save my calendar file ›'}</Text></Pressable>
      <Text style={type.sub}>Free calendar reminders for your unfinished tasks and wedding day. Made on this phone. Save a new file after changing your plan.</Text>
      {files.ready.map(file => <View key={file.id}>{button(file.label, () => { void openFile(file); })}</View>)}
      {files.missing ? <><Text style={type.sub}>{FILE_MISSING_MESSAGE}</Text><GoButton href="/more/full-plan" label="Restore my purchase ›" /></> : null}
      <Text accessibilityRole="header" style={type.section}>{paid ? 'Your full plan' : 'The full plan'}</Text>
      {paid ? null : <Text style={type.sub}>{partOfFullPlan(price)}: payments, your wedding week, reminders and a second phone for your partner.</Text>}
      {paid ? null : <GoButton href="/more/full-plan" label="See the full plan ›" />}
      <GoButton href="/payments" label="Payments ›" />
      <GoButton href="/plan/wedding-week" label="Your wedding week ›" />
      <GoButton href="/reminders" label={paid ? `Reminders: ${reminders} ›` : 'Reminders ›'} />
      <GoButton href={paid ? '/more/sharing' : '/more/full-plan'} label={paid ? 'Two phones: share with my partner ›' : 'Two phones ›'} />
      {paid ? <GoButton href="/more/full-plan" label="Add printables to my plan ›" /> : null}
      <GoButton href="/more/full-plan?newEvent=1" label="Start a new event ›" />
      {button('Privacy policy ›', () => { void open('privacy'); })}
      {button('Terms ›', () => { void open('terms'); })}
      {confirm ? <View style={{ gap: space[3], borderWidth: 1, borderColor: color.rule, padding: space[4] }}>
        <Text accessibilityRole="header" style={type.section}>Delete this plan from this phone?</Text>
        <Text style={type.body}>This removes the date, task ticks, your own tasks, tradition tasks, saved payments, downloaded files, planning details and saved AI signup and marketing choices from this phone, and turns off its reminders. It cannot be undone. Purchases are kept. Copies on other phones and signups already sent to the website stay there.</Text>
        {button('Keep my plan', () => setConfirm(false))}
        {button('Yes, delete from this phone', () => { void remove(); })}
      </View> : button('Delete my plan from this phone', () => setConfirm(true))}
    </>}
  </PlannedScreen>;
}
