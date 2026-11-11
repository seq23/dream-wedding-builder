import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PLAN_WINDOWS } from '@core/dated-plan';
import { addOwnTask, editOwnTask, removeCustomTask, initialTaskWindow } from '../../../src/planTasks';
import { savedProgress } from '../../../src/savedProgress';
import { PlannedScreen } from '../../../src/ui';
import { color, space, type } from '../../../src/theme';
export default function AddTask() {
  const { id, window: requestedWindow } = useLocalSearchParams<{ id?: string; window?: string }>();
  const [text, setText] = useState('');
  const [windowId, setWindow] = useState(() => initialTaskWindow(requestedWindow));
  const [ready, setReady] = useState(!id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    if (!id) return;
    savedProgress.read().then(p => {
      const task = p.custom.find(t => t.id === id);
      if (!task) { setError('This task is no longer in your plan.'); return; }
      setText(task.text); setWindow(task.windowId); setReady(true);
    }).catch(() => setError('Could not read your task. Close and try again.'));
  }, [id]);
  async function save(remove = false) {
    setBusy(true);
    try {
      await savedProgress.update(p => remove && id ? removeCustomTask(p, id) : id ? editOwnTask(p, id, windowId, text) : addOwnTask(p, windowId, text, `own-${Date.now()}-${Math.random().toString(36).slice(2)}`));
      router.replace('/plan');
    } catch { setError('Could not save your task. Try again.'); }
    finally { setBusy(false); }
  }
  return <PlannedScreen route="/plan/add-task" implemented>
    <Text style={type.section}>{id ? 'Edit your task' : 'Add your own task'}</Text>
    {error ? <Text accessibilityRole="alert" style={{ color: color.redPen }}>{error}</Text> : null}
    <Text nativeID="task-label" style={type.label}>Task · {text.length}/140</Text>
    <TextInput accessibilityLabel="Task" accessibilityLabelledBy="task-label" value={text} onChangeText={t => setText(t.slice(0, 140))} maxLength={140} editable={ready && !busy} multiline style={{ minHeight: 96, borderWidth: 1, borderColor: color.rule, padding: space[3], color: color.midnight }} />
    <Text style={type.label}>When</Text>
    {PLAN_WINDOWS.map(w => <Pressable key={w.id} accessibilityRole="radio" accessibilityState={{ checked: w.id === windowId }} disabled={!ready || busy} onPress={() => setWindow(w.id)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={type.body}>{windowId === w.id ? '●' : '○'} {w.label}</Text></Pressable>)}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ready || busy || !text.trim() }} disabled={!ready || busy || !text.trim()} onPress={() => save()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: color.blue }}>{busy ? 'Saving…' : 'Save task'}</Text></Pressable>
    {id && ready ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => confirmDelete ? save(true) : setConfirmDelete(true)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={type.body}>{confirmDelete ? 'Yes, remove this task' : 'Remove task'}</Text></Pressable> : null}
    {confirmDelete ? <Pressable accessibilityRole="button" onPress={() => setConfirmDelete(false)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={type.body}>Keep task</Text></Pressable> : null}
  </PlannedScreen>;
}
