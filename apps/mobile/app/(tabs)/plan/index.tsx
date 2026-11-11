import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { PLAN_WINDOWS, buildDatedPlan, localToday, plainDate } from '@core/dated-plan';
import { emptyProgress, toggleDone, type PlanProgress } from '@core/plan-progress';
import { savedDate } from '../../../src/savedDate';
import { savedProgress } from '../../../src/savedProgress';
import { nextTaskRows, completionDay, taskCount, taskRows } from '../../../src/planTasks';
import { GoButton, PlannedScreen } from '../../../src/ui';
import { hasFullPlan, reminderChoice, syncReminders } from '../../../src/localReminders';
import { shouldOffer } from '../../../src/reminders';
import { color, space, type } from '../../../src/theme';
export default function Plan() {
  const [date, setDate] = useState('');
  const [progress, setProgress] = useState<PlanProgress>(emptyProgress);
  const [windowId, setWindow] = useState(PLAN_WINDOWS[0].id);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    setReady(false);
    Promise.all([savedDate.read(), savedProgress.read()]).then(([d, p]) => {
      if (active) { setDate(d ?? ''); setProgress(p); setReady(true); setError(''); }
      awaitReminderOffer();
    }).catch(() => { if (active) setError('Could not read your plan. Reopen this screen to try again.'); });
    return () => { active = false; };
  }, []));
  async function awaitReminderOffer() {
    try {
      await syncReminders();
      const [choice, paid] = await Promise.all([reminderChoice(), hasFullPlan()]);
      if (shouldOffer(choice, paid)) router.push('/reminders');
    } catch { setError('Could not read reminder settings.'); }
  }
  const plan = buildDatedPlan(date, localToday());
  const rows = taskRows(progress);
  const count = taskCount(progress);
  const catchUp = nextTaskRows(progress);
  async function tick(key: string) {
    setSaving(true);
    try { setProgress(await savedProgress.update(p => toggleDone(p, key, new Date().toISOString()))); setError(''); }
    catch { setError('Your change could not be saved. Try again.'); }
    finally { setSaving(false); }
  }
  const row = (r: ReturnType<typeof taskRows>[number]) => <View key={r.key} style={{ borderBottomWidth: 1, borderColor: color.rule, paddingVertical: space[2] }}>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!r.doneAt, disabled: saving }} disabled={saving} onPress={() => tick(r.key)} style={{ minHeight: 48, justifyContent: 'center' }}>
      <Text style={[type.body, { color: r.doneAt ? color.done : color.midnight }]}>{r.doneAt ? '✓' : '○'} {r.text}</Text>
      {r.doneAt ? <Text style={[type.sub, { color: color.midnightMuted }]}>Done {completionDay(r.doneAt)}</Text> : null}
    </Pressable>
    {r.ownId ? <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/plan/add-task', params: { id: r.ownId } })} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: color.blue }}>Edit your task ›</Text></Pressable> : null}
  </View>;
  return <PlannedScreen route="/plan" implemented>
    {error ? <Text accessibilityRole="alert" style={{ color: color.redPen }}>{error}</Text> : null}
    {!ready ? <Text style={type.body}>Opening your plan…</Text> : <>
      <Text style={type.body}>{plan.headline}</Text>
      {plan.warning ? <Text style={type.body}>{plan.warning}</Text> : null}
      <Text style={type.section}>{count.done} / {count.total} tasks done</Text>
      {catchUp.length ? <View><Text accessibilityRole="header" style={type.section}>Do these next · {catchUp.length}</Text>{catchUp.map(row)}</View> : null}
      <ScrollView horizontal accessibilityRole="tablist" contentContainerStyle={{ gap: space[2] }}>
        {PLAN_WINDOWS.map(w => <Pressable key={w.id} accessibilityRole="tab" accessibilityState={{ selected: windowId === w.id }} onPress={() => setWindow(w.id)} style={{ minHeight: 48, padding: space[3], backgroundColor: windowId === w.id ? color.blueSoft : color.coralSoft }}><Text style={type.button}>{w.label}</Text></Pressable>)}
      </ScrollView>
      {plan.windows.filter(w => w.id === windowId).map(w => <Text key={w.id} style={type.sub}>{plainDate(w.startsOn)} – {plainDate(w.endsOn)}</Text>)}
      {rows.filter(r => r.windowId === windowId).map(row)}
      <GoButton href={`/plan/add-task?window=${windowId}`} label="+ Add your own task" primary />
      <GoButton href="/more/packet" label="Print or send my plan ›" />
      <GoButton href="/plan/ai-draft" label="Draft my plan from a sentence ›" />
    </>}
  </PlannedScreen>;
}
