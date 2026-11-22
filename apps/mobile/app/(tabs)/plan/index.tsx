import { sharingControlsShown } from '../../../src/sharingSwitch';
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
import { rating } from '../../../src/rating';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doneCount, dueBeforeStart, fullPlanRows, screenRows, lockedPlanRows, markAllDone, planBlocks, planOverview, completionDay, startHereView, taskRows, weddingDayRows, whenLine, windowRows } from '../../../src/planTasks';
import { planStartStore } from '../../../src/planStart';
import { GoButton, PlannedScreen } from '../../../src/ui';
import { detailStore } from '../../../src/draftReview';
import { planNotes } from '../../../src/planDetails';
import { partOfFullPlan } from '../../../src/build';
import { useFullPlanPrice } from '../../../src/useFullPlanPrice';
import { hasFullPlan, reminderChoice, syncReminders } from '../../../src/localReminders';
import { shouldOffer } from '../../../src/reminders';
import { color, space, type } from '../../../src/theme';
import { isPick, journeyStore, type SavedJourney } from '../../../src/journey';
import { phoneMetrics } from '../../../src/phoneMetrics';
const AFTER_KEY = 'dw.after-wedding.kept.v1';
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
  const [journey, setJourney] = useState<SavedJourney | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [choosing, setChoosing] = useState<string[] | null>(null);
  const [keptAfter, setKeptAfter] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    setReady(false);
    Promise.all([savedDate.read(), savedProgress.read(), activePlan(), detailStore(AsyncStorage).read().catch(() => ({}))]).then(async ([d, p, shared, details]) => {
      const began = await planStartStore(AsyncStorage).read(d ?? '', localToday()).catch(() => localToday());
      journeyStore(AsyncStorage).read().then(j => { if (active) setJourney(j); }).catch(() => {});
      const kept = await AsyncStorage.getItem(AFTER_KEY).catch(() => null);
      if (active) { setNotes(planNotes(details)); setStartedOn(began); setShared(shared); setDate(d ?? ''); setProgress(p); setKeptAfter(kept); setReady(true); setError(''); void phoneMetrics.record();
        if (buildDatedPlan(d ?? '', localToday()).state === 'today') setWindow('wedding-week'); }
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
  type Row = ReturnType<typeof screenRows>[number];
  const rows: Row[] = screenRows(progress, shared?.list ?? null, date, today);
  const count = { done: doneCount(rows), total: rows.length };
  const overview = planOverview(progress, plan);
  // Full-list tasks are late by their own date; her own tasks, by their window having passed.
  // With no date yet nothing is late: there are no due dates to be late against.
  const overdue = shared ? rows.filter(r => r.ownId ? plan.state !== 'none' && !r.doneAt && !plan.windows.some(w => w.id === r.windowId) : r.late) : overview.overdue;
  // On the wedding day the only block is the day's own list.
  const blocks = plan.state === 'today' ? { startHere: [], catchUp: [], next: weddingDayRows(rows, today) } : planBlocks(rows, overdue, dueBeforeStart(rows, date, startedOn));
  const start = startHereView(blocks.startHere, expanded);
  async function markDone(keys: string[]) {
    setSaving(true);
    try { setProgress(await savedProgress.update(p => markAllDone(p, keys, new Date().toISOString()))); setChoosing(null); setError(''); }
    catch { setError('Your change could not be saved. Try again.'); }
    finally { setSaving(false); }
  }
  async function keepAfter() {
    try { await AsyncStorage.setItem(AFTER_KEY, date); setKeptAfter(date); } catch { setError('Could not save that. Try again.'); }
  }
  async function tick(key: string) {
    setSaving(true);
    try {
      const was = !!progress.done[key];
      const next = await savedProgress.update(p => toggleDone(p, key, new Date().toISOString()));
      setProgress(next); setError('');
      // Success moment: a task ticked done (never an untick), counted as the screen counts them.
      if (!was && next.done[key]) void rating.moment({ kind: 'tasks', done: doneCount(screenRows(next, shared?.list ?? null, date, localToday())) });
    }
    catch { setError('Your change could not be saved. Try again.'); }
    finally { setSaving(false); }
  }
  const pick = (r: Row) => <Pressable key={r.key} accessibilityRole="checkbox" accessibilityState={{ checked: !!choosing?.includes(r.key) }} disabled={saving}
    onPress={() => setChoosing(list => list?.includes(r.key) ? list.filter(k => k !== r.key) : [...(list ?? []), r.key])}
    style={{ minHeight: 48, justifyContent: 'center', borderBottomWidth: 1, borderColor: color.rule }}>
    <Text style={type.body}>{choosing?.includes(r.key) ? '☑' : '☐'} {r.text}</Text>
  </Pressable>;
  const row = (r: Row, overdue = false) => <View key={r.key} style={{ borderBottomWidth: 1, borderColor: color.rule, paddingVertical: space[2] }}>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!r.doneAt, disabled: saving }} disabled={saving} onPress={() => tick(r.key)} style={{ minHeight: 48, justifyContent: 'center' }}>
      <Text style={[type.body, { color: r.doneAt ? color.done : color.midnight }]}>{r.doneAt ? '✓' : '○'} {r.text}</Text>
      <Text style={type.sub}>{whenLine(r, (shared?.list.windows ?? PLAN_WINDOWS).find(w => w.id === r.windowId)?.label, plan, overdue && !r.doneAt)}</Text>
      {isPick(r.ownId) ? <Text style={[type.label, { color: color.blue }]}>Your pick</Text> : null}
      {notes[r.key] ? <Text style={[type.sub, { color: color.midnightMuted }]}>{notes[r.key]}</Text> : null}
      {r.doneAt ? <Text style={[type.sub, { color: color.midnightMuted }]}>Done {completionDay(r.doneAt)}</Text> : null}
    </Pressable>
    {r.ownId && (progress.custom.find(t => t.id === r.ownId) as TraditionCustomTask | undefined)?.tradition ? <Text style={type.sub}>{(n => n && n === journey?.answers.tradition ? `${n} · from your answers` : n)(TRADITION_PREVIEWS.find(p => p.id === (progress.custom.find(t => t.id === r.ownId) as TraditionCustomTask).tradition?.packId)?.name)}</Text> : null}
    {r.ownId ? <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/plan/add-task', params: { id: r.ownId } })} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: color.blue }}>Edit your task ›</Text></Pressable> : null}
  </View>;
  return <PlannedScreen route="/plan">
    {error ? <Text accessibilityRole="alert" style={{ color: color.redPen }}>{error}</Text> : null}
    {!ready ? <Text style={type.body}>Opening your plan…</Text> : <>
      {/* Her wedding page stays one tap from home (the Plan tab stays the home tab). */}
      {!shared ? <Pressable accessibilityRole="button" accessibilityLabel={journey?.read ? `Your wedding: ${journey.read.headline}` : 'Describe your wedding'} onPress={() => router.push('/feel')}
        style={{ gap: 4, padding: space[3], borderRadius: 10, borderWidth: 1, borderColor: color.rule, backgroundColor: color.ivoryRaised }}>
        <Text style={type.label}>Your wedding</Text>
        <Text style={[type.title, { fontSize: 22, lineHeight: 26 }]}>{journey?.read ? journey.read.headline : 'What should your wedding feel like?'}</Text>
        <Text style={[type.button, { color: color.blue }]}>{journey?.read ? `${journey.picks.length ? `${journey.picks.length} kept · ` : ''}Your wedding ›` : 'Describe my wedding ›'}</Text>
      </Pressable> : null}
      <Text style={type.body}>{plan.headline}</Text>
      {plan.state === 'past' && !shared && keptAfter !== date ? <View style={{ gap: space[2] }}>
        <Text style={type.sub}>Keep your plan on this phone to look back on, or close it.</Text>
        <Pressable accessibilityRole="button" onPress={() => { void keepAfter(); }} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[type.button, { color: color.blue }]}>Keep my plan</Text></Pressable>
        <GoButton href="/more?close=1" label="Close my plan ›" />
      </View> : null}
      {/* A full plan bought before a date was set shows the same gentle way to add one. */}
      {plan.state === 'none' ? <GoButton href="/welcome" label="Choose my wedding date ›" primary /> : null}
      {shared ? <><Text style={type.body}>🔒 {shared.event.name}</Text>{sharingControlsShown() ? <GoButton href="/more/sharing" label="♧ Two phones ›" /> : null}</> : null}
      {plan.warning ? <Text style={type.body}>{plan.warning}</Text> : null}
      <Text style={type.section}>{shared ? 'Full plan' : 'Free plan'} · {count.done} of {count.total} tasks done</Text>
      {blocks.startHere.length ? <View><Text accessibilityRole="header" style={type.section}>Start here · {blocks.startHere.length}</Text><Text style={type.sub}>These came before you began. Do the ones that still apply to you.</Text>
        {choosing ? <>
          {blocks.startHere.map(pick)}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving || !choosing.length }} disabled={saving || !choosing.length} onPress={() => { void markDone(choosing); }}
            style={{ minHeight: 48, marginTop: space[2], justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: color.blue, opacity: choosing.length ? 1 : 0.5 }}>
            <Text style={[type.button, { color: color.onBlue }]}>{choosing.length ? `Mark ${choosing.length} as done ›` : 'Tick the ones you have done'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setChoosing(null)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[type.button, { color: color.blue }]}>Cancel</Text></Pressable>
        </> : <>
          {start.shown.map(r => row(r, true))}
          {start.hidden ? <Pressable accessibilityRole="button" onPress={() => setExpanded(true)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[type.button, { color: color.blue }]}>Show {start.hidden} more ›</Text></Pressable> : null}
          <Pressable accessibilityRole="button" onPress={() => setChoosing([])} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[type.button, { color: color.blue }]}>Already done some? Tick several at once ›</Text></Pressable>
        </>}
      </View> : null}
      {blocks.catchUp.length ? <View><Text accessibilityRole="header" style={type.section}>Catch up · {blocks.catchUp.length}</Text>{blocks.catchUp.map(r => row(r, true))}</View> : null}
      {blocks.next.length ? <View><Text accessibilityRole="header" style={type.section}>{plan.state === 'today' ? 'Today' : 'Do these next'} · {blocks.next.length}</Text>{blocks.next.map(r => row(r))}{overview.nextStartsOn ? <Text style={type.sub}>The next set starts {plainDate(overview.nextStartsOn)}.</Text> : null}</View> : null}
      <ScrollView horizontal accessibilityRole="tablist" contentContainerStyle={{ gap: space[2] }}>
        {(shared ? shared.list.windows : PLAN_WINDOWS).map(w => <Pressable key={w.id} accessibilityRole="tab" accessibilityState={{ selected: windowId === w.id }} onPress={() => setWindow(w.id)} style={{ minHeight: 48, padding: space[3], backgroundColor: windowId === w.id ? color.blueSoft : color.coralSoft }}><Text style={type.button}>{w.label}</Text></Pressable>)}
      </ScrollView>
      {plan.windows.filter(w => w.id === windowId).map(w => <Text key={w.id} style={type.sub}>{plainDate(w.startsOn)} – {plainDate(w.endsOn)}</Text>)}
      {windowRows(rows, blocks, windowId).map(r => row(r))}
      {(!shared ? lockedPlanRows(date, windowId, startedOn) : []).map(r => <Pressable key={r.text} accessibilityRole="button" onPress={() => router.push(r.href)} style={{ minHeight: 64, paddingVertical: space[2], borderBottomWidth: 1, borderColor: color.rule }}>
        <Text style={[type.body, { color: color.midnightMuted }]}>🔒 {r.text}</Text>
        <Text style={type.sub}>{r.dueOn ? `By ${plainDate(r.dueOn)}` : 'Do now'} · {partOfFullPlan(price)} ›</Text>
      </Pressable>)}
      <GoButton href={`/plan/add-task?window=${windowId}`} label="+ Add your own task" primary={plan.state !== 'none'} />
      <GoButton href="/plan/ai-draft" label={Object.keys(notes).length ? 'Change my guests, place and budget ›' : 'Add my guests, place and budget ›'} />
      <GoButton href="/more/packet" label="Print or send my plan ›" />
      <GoButton href="/plan/wedding-week" label={shared ? 'Your wedding week ›' : 'Wedding week · in the full plan ›'} />
    </>}
  </PlannedScreen>;
}
