import { activePlan } from '../../../src/sharing/runtime';
import { useSharingRevision } from '../../../src/sharing/useSharing';
import { taskDate } from '@core/full-plan';
import type { SharedPlan } from '../../../src/sharing/session';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { PLAN_WINDOWS, buildDatedPlan, localToday, plainDate } from '@core/dated-plan';
import { taskKey, emptyProgress, toggleDone, type PlanProgress } from '@core/plan-progress';
import { TRADITION_PREVIEWS, type TraditionCustomTask } from '../../../src/traditionPacks';
import { savedDate } from '../../../src/savedDate';
import { savedProgress } from '../../../src/savedProgress';
import { lockedPlanRows, planOverview, completionDay, taskCount, taskRows } from '../../../src/planTasks';
import { GoButton, PlannedScreen } from '../../../src/ui';
import { hasFullPlan, reminderChoice, syncReminders } from '../../../src/localReminders';
import { shouldOffer } from '../../../src/reminders';
import { color, space, type } from '../../../src/theme';
export default function Plan() {
  const sharingRevision = useSharingRevision();
  const [shared, setShared] = useState<SharedPlan | null>(null);
  const [date, setDate] = useState('');
  const [progress, setProgress] = useState<PlanProgress>(emptyProgress);
  const [windowId, setWindow] = useState(PLAN_WINDOWS[0].id);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    setReady(false);
    Promise.all([savedDate.read(), savedProgress.read(), activePlan()]).then(([d, p, shared]) => {
      if (active) { setShared(shared); setDate(d ?? ''); setProgress(p); setReady(true); setError(''); }
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
  const plan = buildDatedPlan(date, localToday());
  const rows = shared ? [
    ...shared.list.tasks.map(t => ({ key: taskKey(t.window, t.text), windowId: t.window, text: t.text, ownId: undefined as string | undefined, doneAt: progress.done[taskKey(t.window, t.text)] })),
    ...taskRows(progress).filter(t => t.ownId),
  ] : taskRows(progress);
  const count = { done: rows.filter(r => r.doneAt).length, total: rows.length };
  const overview = planOverview(progress, plan);
  const overdue = shared ? rows.filter(r => !r.doneAt && !plan.windows.some(w => w.id === r.windowId)) : overview.overdue;
  const catchUp = rows.filter(r => !r.doneAt).slice(0, 3);
  async function tick(key: string) {
    setSaving(true);
    try { setProgress(await savedProgress.update(p => toggleDone(p, key, new Date().toISOString()))); setError(''); }
    catch { setError('Your change could not be saved. Try again.'); }
    finally { setSaving(false); }
  }
  const row = (r: ReturnType<typeof taskRows>[number]) => <View key={r.key} style={{ borderBottomWidth: 1, borderColor: color.rule, paddingVertical: space[2] }}>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!r.doneAt, disabled: saving }} disabled={saving} onPress={() => tick(r.key)} style={{ minHeight: 48, justifyContent: 'center' }}>
      <Text style={[type.body, { color: r.doneAt ? color.done : color.midnight }]}>{r.doneAt ? '✓' : '○'} {r.text}</Text>
      <Text style={type.sub}>{PLAN_WINDOWS.find(w => w.id === r.windowId)?.label}{shared?.list.tasks.find(t => taskKey(t.window,t.text) === r.key) ? ` · By ${plainDate(taskDate(date,shared.list.tasks.find(t => taskKey(t.window,t.text) === r.key)!.daysBefore)! )}` : plan.windows.find(w => w.id === r.windowId) ? ` · By ${plainDate(plan.windows.find(w => w.id === r.windowId)!.endsOn)}` : ' · Catch up'}</Text>
      {r.doneAt ? <Text style={[type.sub, { color: color.midnightMuted }]}>Done {completionDay(r.doneAt)}</Text> : null}
    </Pressable>
    {r.ownId && (progress.custom.find(t => t.id === r.ownId) as TraditionCustomTask | undefined)?.tradition ? <Text style={type.sub}>{TRADITION_PREVIEWS.find(p => p.id === (progress.custom.find(t => t.id === r.ownId) as TraditionCustomTask).tradition?.packId)?.name}</Text> : null}
    {r.ownId ? <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/plan/add-task', params: { id: r.ownId } })} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: color.blue }}>Edit your task ›</Text></Pressable> : null}
  </View>;
  return <PlannedScreen route="/plan" implemented>
    {error ? <Text accessibilityRole="alert" style={{ color: color.redPen }}>{error}</Text> : null}
    {!ready ? <Text style={type.body}>Opening your plan…</Text> : <>
      <Text style={type.body}>{plan.headline}</Text>
      {shared ? <><Text style={type.body}>🔒 {shared.event.name}</Text><GoButton href="/more/sharing" label="♧ Two phones ›" /></> : null}
      {plan.warning ? <Text style={type.body}>{plan.warning}</Text> : null}
      <Text style={type.section}>{count.done} / {count.total} tasks done</Text>
      {catchUp.length ? <View><Text accessibilityRole="header" style={type.section}>Do these next · {catchUp.length}</Text>{catchUp.map(row)}{overview.nextStartsOn ? <Text style={type.sub}>The next set starts {plainDate(overview.nextStartsOn)}.</Text> : null}</View> : null}
      {overdue.length ? <View><Text accessibilityRole="header" style={type.section}>Catch up · {overdue.length}</Text>{overdue.map(row)}</View> : null}
      <ScrollView horizontal accessibilityRole="tablist" contentContainerStyle={{ gap: space[2] }}>
        {(shared ? shared.list.windows : PLAN_WINDOWS).map(w => <Pressable key={w.id} accessibilityRole="tab" accessibilityState={{ selected: windowId === w.id }} onPress={() => setWindow(w.id)} style={{ minHeight: 48, padding: space[3], backgroundColor: windowId === w.id ? color.blueSoft : color.coralSoft }}><Text style={type.button}>{w.label}</Text></Pressable>)}
      </ScrollView>
      {plan.windows.filter(w => w.id === windowId).map(w => <Text key={w.id} style={type.sub}>{plainDate(w.startsOn)} – {plainDate(w.endsOn)}</Text>)}
      {rows.filter(r => r.windowId === windowId).map(row)}
      {(!shared ? lockedPlanRows(date, windowId) : []).map(r => <Pressable key={r.text} accessibilityRole="button" onPress={() => router.push(r.href)} style={{ minHeight: 64, paddingVertical: space[2], borderBottomWidth: 1, borderColor: color.rule }}>
        <Text style={[type.body, { color: color.midnightMuted }]}>🔒 {r.text}</Text>
        <Text style={type.sub}>{plainDate(r.dueOn)} · Full plan ›</Text>
      </Pressable>)}
      <GoButton href={`/plan/add-task?window=${windowId}`} label="+ Add your own task" primary />
      <GoButton href="/more/packet" label="Print or send my plan ›" />
      <GoButton href="/plan/wedding-week" label="Your wedding week ›" />
      <GoButton href="/plan/ai-draft" label="Draft my plan from a sentence ›" />
    </>}
  </PlannedScreen>;
}
