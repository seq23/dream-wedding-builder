import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, Text, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { aiDraftClient } from '../../../src/aiDraft';
import { detailLabels, detailStore, initialDetails, reviewFields, type Details } from '../../../src/draftReview';
import { savedDate } from '../../../src/savedDate';
import { WeddingDatePicker } from '../../../src/WeddingDatePicker';
import { PlannedScreen } from '../../../src/ui';
import { color, space, type } from '../../../src/theme';
const store = detailStore(AsyncStorage);
export default function AiDraft() {
  const client = useMemo(() => aiDraftClient(AsyncStorage), []);
  const [fields, setFields] = useState<Details>({});
  const [sentence, setSentence] = useState('');
  const [email, setEmail] = useState('');
  const [helper, setHelper] = useState(false);
  const [consent, setConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const [review, setReview] = useState<Details | null>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [undo, setUndo] = useState<{ fields: Details; date: string } | null>(null);
  useEffect(() => { initialDetails(store, savedDate).then(setFields).then(() => setReady(true)).catch(() => setMessage('Could not read your details. Close and try again.')); }, []);
  async function request() {
    setBusy(true);
    try {
      const reply = await client.request({ email, description: sentence, consent, marketing });
      setMessage(reply.message);
      if (reply.ok && reply.draft) { setReview(reviewFields(reply.draft)); setExcluded([]); }
    } finally { setBusy(false); }
  }
  async function save(selected: Details) {
    setBusy(true);
    try {
      const previous = { fields: await store.read(), date: await savedDate.read() ?? '' };
      const next = { ...fields, ...selected };
      if (selected.weddingDate !== undefined) await savedDate.save(selected.weddingDate);
      await store.save(next);
      setFields(next); setUndo(previous); setReview(null); setMessage('Saved. Go back to your plan to see them on your tasks.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save your details. Try again.'); }
    finally { setBusy(false); }
  }
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled || busy} onPress={action} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[type.button, { color: disabled || busy ? color.midnightMuted : color.blue }]}>{label}</Text></Pressable>;
  const box = (label: string, checked: boolean, action: () => void) => <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} disabled={busy} onPress={action} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={type.body}>{checked ? '☑' : '☐'} {label}</Text></Pressable>;
  return <PlannedScreen route="/plan/ai-draft">
    <Text style={type.title}>{review ? 'Check your draft' : 'Guests, place and budget'}</Text>
    {review ? <>
      <Text style={type.body}>Nothing has changed yet. Choose the details you want to keep.</Text>
      {(Object.keys(review) as (keyof Details)[]).map(key => <Pressable key={key} accessibilityRole="checkbox" accessibilityState={{ checked: !excluded.includes(key) }} disabled={busy} onPress={() => setExcluded(old => old.includes(key) ? old.filter(k => k !== key) : [...old, key])} style={{ minHeight: 48 }}><Text style={type.body}>{excluded.includes(key) ? '☐' : '☑'} {detailLabels[key]}: {review[key]}</Text></Pressable>)}
      {button('Save the ticked details ›', () => save(Object.fromEntries(Object.entries(review).filter(([key]) => !excluded.includes(key)))), Object.keys(review).every(key => excluded.includes(key)))}
      {button('Discard draft', () => { setReview(null); setMessage(''); })}
    </> : <>
      <Text style={type.body}>What you add here shows on the tasks it affects: your guest count on the venue and caterer tasks, your place on the venue and license tasks, and your budget shared out across what you book. Everything is optional and stays on this phone.</Text>
      <Text style={type.label}>Wedding date (optional)</Text>
      <WeddingDatePicker value={fields.weddingDate ?? ''} onChange={weddingDate => setFields(old => ({ ...old, weddingDate }))} />
      {fields.weddingDate ? button('I don’t have a date yet: clear it ›', () => setFields(old => ({ ...old, weddingDate: '' }))) : null}
      {(['guestCount', 'locations', 'budgetTarget', 'priorities'] as const).map(key => <TextInput key={key} accessibilityLabel={`${detailLabels[key]} (optional)`} placeholder={`${detailLabels[key]} (optional)`} value={fields[key] ?? ''} editable={ready && !busy} maxLength={200} onChangeText={value => setFields(old => ({ ...old, [key]: value }))} style={{ minHeight: 48, borderWidth: 1, borderColor: color.rule, padding: space[3], color: color.midnight }} />)}
      {button('Save and show on my plan ›', () => save(fields), !ready)}
      {button(helper ? 'Fill it in from a sentence (free AI) ▴' : 'Fill it in from a sentence (free AI) ▾', () => setHelper(!helper))}
      {helper ? <>
        <TextInput accessibilityLabel="Describe your wedding" placeholder="Describe your wedding" value={sentence} onChangeText={setSentence} editable={!busy} multiline maxLength={1600} style={{ minHeight: 96, borderColor: color.rule, borderWidth: 1, padding: space[3] }} />
        <TextInput accessibilityLabel="Email for the AI draft" placeholder="Email" value={email} onChangeText={setEmail} editable={!busy} keyboardType="email-address" autoCapitalize="none" style={{ minHeight: 48, borderColor: color.rule, borderWidth: 1, padding: space[3] }} />
        <Text style={type.sub}>This is the only place we ask for email. It checks your free draft allowance.</Text>
        {box('Optional: email me wedding planning news and offers.', marketing, () => setMarketing(!marketing))}
        {box('Send my sentence to a free AI model outside the app. Nothing is sent until I tick this and press the button.', consent, () => setConsent(!consent))}
        {button('Privacy policy', () => { void Linking.openURL('https://weddingchecklistpdf.com/privacy'); })}
        {message ? <Text accessibilityRole="alert" style={type.body}>{message}</Text> : null}
        {button(busy ? 'Preparing your draft…' : 'Send for a free draft', request, !ready || !consent || !sentence.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()))}
      </> : null}
    </>}
    {message && (!helper || review) ? <Text accessibilityRole="alert" style={type.body}>{message}</Text> : null}
    {undo ? button('Undo saved details', async () => { setBusy(true); try { await savedDate.save(undo.date); await store.save(undo.fields); setFields(undo.fields); setUndo(null); setMessage('Previous details restored.'); } catch { setMessage('Could not undo. Try again.'); } finally { setBusy(false); } }) : null}
  </PlannedScreen>;
}
