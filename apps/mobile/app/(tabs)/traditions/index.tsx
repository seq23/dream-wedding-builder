import { useCallback, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { PLAN_WINDOWS } from '@core/dated-plan';
import { emptyProgress, type PlanProgress } from '@core/plan-progress';
import { GoButton, PlannedScreen } from '../../../src/ui';
import { savedProgress } from '../../../src/savedProgress';
import { TRADITION_PREVIEWS, addTraditionExample, hasTraditionPack, removeTraditionPack, restoreTraditionTasks } from '../../../src/traditionPacks';
import { purchases } from '../../../src/billing/current';
import { loadTraditions } from '../../../src/traditionView';
import { color, radius, space, type } from '../../../src/theme';

export default function Traditions() {
  const [progress, setProgress] = useState<PlanProgress>(emptyProgress);
  const [selected, setSelected] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [removed, setRemoved] = useState<PlanProgress['custom'] | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    setReady(false); setLoadFailed(false);
    loadTraditions(savedProgress.read).then(p => { if (active) { setProgress(p); setReady(true); setError(''); } })
      .catch(() => { if (active) { setLoadFailed(true); setReady(true); setError('Could not read your plan. Return to your plan and try again.'); } });
    return () => { active = false; };
  }, []));
  const pack = TRADITION_PREVIEWS.find(p => p.id === selected);
  const added = !!pack && hasTraditionPack(progress, pack.id);
  async function change(action: 'add' | 'remove' | 'undo') {
    if (!pack || busy) return;
    setBusy(true);
    try {
      let deleted: PlanProgress['custom'] = [];
      const next = await savedProgress.update(p => {
        if (action === 'add') return addTraditionExample(p, pack.id);
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
  return <PlannedScreen route="/traditions" implemented>
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
      <Text style={type.body}>The rest of this pack comes with the full plan. Purchases are not set up yet.</Text>
      {button(added ? 'Added' : 'Add free example to my plan', () => { void change('add'); }, !added, added)}
      {added ? <GoButton href="/plan" label="See tasks in my plan ›" /> : purchases.available ? <GoButton href="/more/full-plan" label="See the full plan ›" /> : null}
      {added && !confirm ? button('Remove this pack', () => setConfirm(true)) : null}
      {confirm ? <View style={{ gap: space[2] }}>
        <Text style={type.body}>Remove this pack? Tasks you have ticked or edited stay in your plan. Untouched tasks are removed.</Text>
        {button('Yes, remove this pack', () => { void change('remove'); })}
        {button('Keep this pack', () => setConfirm(false))}
      </View> : null}
      {removed ? <View><Text accessibilityRole="status" style={type.body}>Untouched tasks removed. Ticked or edited tasks stay.</Text>{removed.length ? button('Undo removal', () => { void change('undo'); }) : null}</View> : null}
    </> : <>
      <Text accessibilityRole="header" style={type.title}>Traditions</Text>
      <Text style={type.body}>These packs are optional. Add their tasks to your plan in the right time windows.</Text>
      {TRADITION_PREVIEWS.map(p => <Pressable key={p.id} accessibilityRole="button" onPress={() => { setSelected(p.id); setConfirm(false); setRemoved(null); }} style={{ minHeight: 64, paddingVertical: space[3], borderBottomWidth: 1, borderColor: color.rule, gap: space[1] }}>
        <Text style={type.section}>{p.name} {hasTraditionPack(progress, p.id) ? '✓ Added' : '›'}</Text>
        <Text style={type.sub}>{p.example.text}</Text>
      </Pressable>)}
      <GoButton href="/plan/add-task" label="Write my own task ›" />
    </>}
  </PlannedScreen>;
}
