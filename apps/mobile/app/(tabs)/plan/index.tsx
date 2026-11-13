import { activePlan } from '../../../src/sharing/runtime';
import { useSharingRevision } from '../../../src/sharing/useSharing';
import type { SharedPlan } from '../../../src/sharing/session';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { PLAN_WINDOWS, buildDatedPlan, localToday, plainDate } from '@core/dated-plan';
import { taskKey, emptyProgress, toggleDone, type PlanProgress } from '@core/plan-progress';
import { TRADITION_PREVIEWS, type TraditionCustomTask } from '../../../src/traditionPacks';
import { savedDate } from '../../../src/savedDate';
import { savedProgress } from '../../../src/savedProgress';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dueBeforeStart, fullPlanRows, lockedPlanRows, planBlocks, planOverview, completionDay, taskRows } from '../../../src/planTasks';
import { planStartStore } from '../../../src/planStart';
import { GoButton, PlannedScreen } from '../../../src/ui';
import { detailStore } from '../../../src/draftReview';
import { planNotes } from '../../../src/planDetails';
import { partOfFullPlan } from '../../../src/build';
import { useFullPlanPrice } from '../../../src/useFullPlanPrice';
import { hasFullPlan, reminderChoice, syncReminders } from '../../../src/localReminders';
import { shouldOffer } from '../../../src/reminders';
import { color, space, type } from '../../../src/theme';
import { phoneMetrics } from '../../../src/phoneMetrics';
export default function Plan() {
  const sharingRevision = useSharingRevision();
  const [shared, setShared] = useState<SharedPlan | null>(null);
  const [date, setDate] = useState('');
  const [startedOn, setStartedOn] = useState(localToday());
  const [progress, setProgress] = useState<PlanProgress>(emptyProgress);
  const [windowId, setWindow] = useState(PLAN_WINDOWS[0].id);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const price = useFullPlanPrice();
  useFocusEffect(useCallback(() => {
    let active = true;
    setReady(false);
    Promise.all([savedDate.read(), savedProgress.read(), activePlan(), detailStore(AsyncStorage).read().catch(() => ({}))]).then(async ([d, p, shared, details]) => {
      const began = await planStartStore(AsyncStorage).read(d ?? '', localToday()).catch(() => localToday());
      if (active) { setNotes(planNotes(details)); setStartedOn(began); setShared(shared); setDate(d ?? ''); setProgress(p); setReady(true); setError(''); void phoneMetrics.record(); }
      awaitReminderOffer();
    }).catch(() => { if (active) setError('Could not read your plan. Reopen this screen to try again.'); });
    return () => { active = false; };
  }, [sharingRevision]));
  async function awaitReminderOffer() {
    try {
      await syncReminders();
      const [choice, paid] = await Promise.all([reminderChoice(), hasFullPlan()]);
      if (shouldOffer(choice, paid)) router.push('/reminders');
    } catch { setError('Could not read reminder settings.'); }
  }
  const today = localToday();
  const plan = buildDatedPlan(date, today);
  type Row = ReturnType<typeof taskRows>[number] & { dueOn?: string | null; late?: boolean };
  const rows: Row[] = shared ? [
    ...fullPlanRows(shared.list, progress, date, today),
    ...taskRows(progress).filter(t => t.ownId),
  ] : taskRows(progress);
  const count = { done: rows.filter(r => r.doneAt).length, total: rows.length };
  const overview = planOverview(progress, plan);
  // Full-list tasks are late by their own date; her own tasks, by their window having passed.
  const overdue = shared ? rows.filter(r => r.ownId ? !r.doneAt && !plan.windows.some(w => w.id === r.windowId) : r.late) : overview.overdue;
  const blocks = planBlocks(rows, overdue, dueBeforeStart(rows, date, startedOn));
  async function tick(key: string) {
    setSaving(true);
    try { setProgress(await savedProgress.update(p => toggleDone(p, key, new Date().toISOString()))); setError(''); }
    catch { setError('Your change could not be saved. Try again.'); }
    finally { setSaving(false); }
  }
  const row = (r: Row, undated = '') => <View key={r.key} style={{ borderBottomWidth: 1, borderColor: color.rule, paddingVertical: space[2] }}>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!r.doneAt, disabled: saving }} disabled={saving} onPress={() => tick(r.key)} style={{ minHeight: 48, justifyContent: 'center' }}>
      <Text style={[type.body, { color: r.doneAt ? color.done : color.midnight }]}>{r.doneAt ? '✓' : '○'} {r.text}</Text>
      <Text style={type.sub}>{(shared?.list.windows ?? PLAN_WINDOWS).find(w => w.id === r.windowId)?.label}{r.dueOn ? ` · By ${plainDate(r.dueOn)}` : plan.windows.find(w => w.id === r.windowId) ? ` · By ${plainDate(plan.windows.find(w => w.id === r.windowId)!.endsOn)}` : undated}</Text>
      {notes[r.key] ? <Text style={[type.sub, { color: color.midnightMuted }]}>{notes[r.key]}</Text> : null}
      {r.doneAt ? <Text style={[type.sub, { color: color.midnightMuted }]}>Done {completionDay(r.doneAt)}</Text> : null}
    </Pressable>
    {r.ownId && (progress.custom.find(t => t.id === r.ownId) as TraditionCustomTask | undefined)?.tradition ? <Text style={type.sub}>{TRADITION_PREVIEWS.find(p => p.id === (progress.custom.find(t => t.id === r.ownId) as TraditionCustomTask).tradition?.packId)?.name}</Text> : null}
    {r.ownId ? <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/plan/add-task', params: { id: r.ownId } })} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: color.blue }}>Edit your task ›</Text></Pressable> : null}
  </View>;
  return <PlannedScreen route="/plan">
    {error ? <Text accessibilityRole="alert" style={{ color: color.redPen }}>{error}</Text> : null}
    {!ready ? <Text style={type.body}>Opening your plan…</Text> : <>
      <Text style={type.body}>{plan.headline}</Text>
      {shared ? <><Text style={type.body}>🔒 {shared.event.name}</Text><GoButton href="/more/sharing" label="♧ Two phones ›" /></> : null}
      {plan.warning ? <Text style={type.body}>{plan.warning}</Text> : null}
      <Text style={type.section}>{shared ? 'Full plan' : 'Free plan'} · {count.done} of {count.total} tasks done</Text>
      {blocks.startHere.length ? <View><Text accessibilityRole="header" style={type.section}>Start here · {blocks.startHere.length}</Text><Text style={type.sub}>These came before you began. Do the ones that still apply to you.</Text>{blocks.startHere.map(r => row(r, ' · Start here'))}</View> : null}
      {blocks.catchUp.length ? <View><Text accessibilityRole="header" style={type.section}>Catch up · {blocks.catchUp.length}</Text>{blocks.catchUp.map(r => row(r, ' · Catch up'))}</View> : null}
      {blocks.next.length ? <View><Text accessibilityRole="header" style={type.section}>Do these next · {blocks.next.length}</Text>{blocks.next.map(r => row(r))}{overview.nextStartsOn ? <Text style={type.sub}>The next set starts {plainDate(overview.nextStartsOn)}.</Text> : null}</View> : null}
      <ScrollView horizontal accessibilityRole="tablist" contentContainerStyle={{ gap: space[2] }}>
        {(shared ? shared.list.windows : PLAN_WINDOWS).map(w => <Pressable key={w.id} accessibilityRole="tab" accessibilityState={{ selected: windowId === w.id }} onPress={() => setWindow(w.id)} style={{ minHeight: 48, padding: space[3], backgroundColor: windowId === w.id ? color.blueSoft : color.coralSoft }}><Text style={type.button}>{w.label}</Text></Pressable>)}
      </ScrollView>
      {plan.windows.filter(w => w.id === windowId).map(w => <Text key={w.id} style={type.sub}>{plainDate(w.startsOn)} – {plainDate(w.endsOn)}</Text>)}
      {rows.filter(r => r.windowId === windowId).map(r => row(r))}
      {(!shared ? lockedPlanRows(date, windowId, startedOn) : []).map(r => <Pressable key={r.text} accessibilityRole="button" onPress={() => router.push(r.href)} style={{ minHeight: 64, paddingVertical: space[2], borderBottomWidth: 1, borderColor: color.rule }}>
        <Text style={[type.body, { color: color.midnightMuted }]}>🔒 {r.text}</Text>
        <Text style={type.sub}>{r.dueOn ? plainDate(r.dueOn) : 'Start here'} · {partOfFullPlan(price)} ›</Text>
      </Pressable>)}
      <GoButton href={`/plan/add-task?window=${windowId}`} label="+ Add your own task" primary />
      <GoButton href="/plan/ai-draft" label={Object.keys(notes).length ? 'Change my guests, place and budget ›' : 'Add my guests, place and budget ›'} />
      <GoButton href="/more/packet" label="Print or send my plan ›" />
      <GoButton href="/plan/wedding-week" label={shared ? 'Your wedding week ›' : 'Wedding week · in the full plan ›'} />
    </>}
  </PlannedScreen>;
}
