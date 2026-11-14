import { activePlan } from '../../../src/sharing/runtime';
import { useSharingRevision } from '../../../src/sharing/useSharing';
import type { SharedPlan } from '../../../src/sharing/session';
import { useCallback, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { journeyStore, traditionPackFor } from '../../../src/journey';
import { PLAN_WINDOWS } from '@core/dated-plan';
import { emptyProgress, type PlanProgress } from '@core/plan-progress';
import { GoButton, PlannedScreen } from '../../../src/ui';
import { savedProgress } from '../../../src/savedProgress';
import { TRADITION_PREVIEWS, addTraditionPack, addTraditionExample, hasTraditionPack, removeTraditionPack, restoreTraditionTasks } from '../../../src/traditionPacks';
import { loadTraditions } from '../../../src/traditionView';
import { color, radius, space, type } from '../../../src/theme';
import { partOfFullPlan } from '../../../src/build';
import { useFullPlanPrice } from '../../../src/useFullPlanPrice';

export default function Traditions() {
  const sharingRevision = useSharingRevision();
  const [shared, setShared] = useState<SharedPlan | null>(null);
  const [progress, setProgress] = useState<PlanProgress>(emptyProgress);
  const [selected, setSelected] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [removed, setRemoved] = useState<PlanProgress['custom'] | null>(null);
  const price = useFullPlanPrice();
  const [mine, setMine] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    setReady(false); setLoadFailed(false);
    journeyStore(AsyncStorage).read().then(j => { if (active) setMine(traditionPackFor(j?.answers.tradition)?.id ?? null); }).catch(() => {});
    Promise.all([loadTraditions(savedProgress.read), activePlan()]).then(([p, plan]) => { if (active) { setShared(plan); setProgress(p); setReady(true); setError(''); } })
      .catch(() => { if (active) { setLoadFailed(true); setReady(true); setError('Could not read your plan. Return to your plan and try again.'); } });
    return () => { active = false; };
  }, [sharingRevision]));
  const pack = TRADITION_PREVIEWS.find(p => p.id === selected);
  const fullPack = shared?.packs?.find(p => p.id === pack?.id);
  const added = !!pack && (fullPack ? fullPack.tasks.every(t => progress.custom.some(c => c.id === `tradition:${fullPack.id}:${t.id}`)) : hasTraditionPack(progress, pack.id));
  async function change(action: 'add' | 'remove' | 'undo') {
    if (!pack || busy) return;
    setBusy(true);
    try {
      let deleted: PlanProgress['custom'] = [];
      const next = await savedProgress.update(p => {
        if (action === 'add') { const full = shared?.packs?.find(p => p.id === pack.id); return full ? addTraditionPack(p, full, true) : addTraditionExample(p, pack.id); }
        if (action === 'undo') return restoreTraditionTasks(p, removed ?? []);
        const result = removeTraditionPack(p, pack.id);
        deleted = p.custom.filter(t => !result.custom.some(kept => kept.id === t.id));
        return result;
      });
      setProgress(next); setConfirm(false); setError('');
      setRemoved(action === 'remove' ? deleted : null);
    } catch { setError('Your change could not be saved. Try again.'); }
    finally { setBusy(false); }
  }
  const button = (label: string, onPress: () => void, primary = false, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || disabled }} disabled={busy || disabled} onPress={onPress}
    style={{ minHeight: 48, justifyContent: 'center', padding: space[3], borderRadius: radius.md, backgroundColor: primary ? color.blue : color.ivory, opacity: busy || disabled ? 0.5 : 1 }}>
    <Text style={[type.button, { color: primary ? color.onBlue : color.blue }]}>{label}</Text>
  </Pressable>;
  return <PlannedScreen route="/traditions">
    {error ? <Text accessibilityRole="alert" style={type.body}>{error}</Text> : null}
    {loadFailed ? <GoButton href="/plan" label="Back to my plan ›" /> : !ready ? <Text style={type.body}>Opening your traditions…</Text> : pack ? <>
      {button('← Back to traditions', () => { setSelected(null); setConfirm(false); setRemoved(null); })}
      <Text accessibilityRole="header" style={type.title}>{pack.name}</Text>
      <Text style={type.body}>Use this optional starting point to discuss the traditions you want to include.</Text>
      <View style={{ gap: space[2] }}>
        <Text style={type.label}>Free example</Text>
        <Text style={type.body}>{pack.example.text}</Text>
        <Text style={type.sub}>{PLAN_WINDOWS.find(w => w.id === pack.example.windowId)?.label}</Text>
        {button('Read the source ›', () => { Linking.openURL(pack.example.source).catch(() => setError('Could not open the source. Try again.')); })}
      </View>
      <Text style={type.body}>{shared ? 'This pack is included in your shared full plan.' : `This example is free. The rest of this pack is ${partOfFullPlan(price, 'part')}.`}</Text>
      {button(added ? 'Added' : shared?.packs?.some(p => p.id === pack.id) ? 'Add to my plan' : 'Add free example to my plan', () => { void change('add'); }, !added, added)}
      {added ? <GoButton href="/plan" label="See tasks in my plan ›" /> : null}
      {!shared ? <GoButton href="/more/full-plan" label="See the full plan ›" /> : null}
      {added && !confirm ? button('Remove this pack', () => setConfirm(true)) : null}
      {confirm ? <View style={{ gap: space[2] }}>
        <Text style={type.body}>Remove this pack? Tasks you have ticked or edited stay in your plan. Untouched tasks are removed.</Text>
        {button('Yes, remove this pack', () => { void change('remove'); })}
        {button('Keep this pack', () => setConfirm(false))}
      </View> : null}
      {removed ? <View><Text accessibilityRole="status" style={type.body}>Untouched tasks removed. Ticked or edited tasks stay.</Text>{removed.length ? button('Undo removal', () => { void change('undo'); }) : null}</View> : null}
    </> : <>
      <Text accessibilityRole="header" style={type.title}>Traditions</Text>
      <Text style={type.body}>These packs are optional. Add their tasks to your plan at the right time.</Text>
      {!shared ? <Text style={type.sub}>One example from each pack is free. The full packs are {partOfFullPlan(price, 'part')}.</Text> : null}
      {/* The tradition she picked in step 1 of the journey comes first. */}
      {[...TRADITION_PREVIEWS].sort((x, y) => Number(y.id === mine) - Number(x.id === mine)).map(p => <Pressable key={p.id} accessibilityRole="button" onPress={() => { setSelected(p.id); setConfirm(false); setRemoved(null); }} style={{ minHeight: 64, paddingVertical: space[3], borderBottomWidth: 1, borderColor: color.rule, gap: space[1] }}>
        <Text style={type.section}>{p.name} {hasTraditionPack(progress, p.id) ? '✓ Added' : '›'}</Text>
        {p.id === mine ? <Text style={[type.label, { color: color.blue }]}>From your answers</Text> : null}
        <Text style={type.sub}>{p.example.text}</Text>
      </Pressable>)}
      <GoButton href="/plan/add-task" label="Write my own task ›" />
    </>}
  </PlannedScreen>;
}
