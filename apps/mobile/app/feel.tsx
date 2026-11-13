import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlannedScreen } from '../src/ui';
import { PREVIEW } from '../src/build';
import { savedProgress } from '../src/savedProgress';
import { MOODS, SEASONS, SETTINGS, applyPicks, journeyStore, pickable, readLabel, weddingReadClient,
  type JourneyAnswers, type JourneyPick, type ReadReason, type WeddingRead } from '../src/journey';
import { color, radius, space, type } from '../src/theme';

// The first screen for someone new (docs/APP_PLAN.md, pattern (j)): what should the wedding
// feel like, then her wedding on one page with rows she taps to keep. Kept rows become her
// own tasks marked "Your pick"; then the date screen, as before.
const store = journeyStore(AsyncStorage);
const EMPTY: JourneyAnswers = { path: 'dk', wish: '', season: '', setting: '', moods: [], where: '', guests: '', venueBooked: false };

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onPress}
    style={{ minHeight: 44, paddingHorizontal: space[4], justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1.5, borderColor: on ? color.blue : color.rule, backgroundColor: on ? color.blueSoft : color.ivoryRaised }}>
    <Text style={[type.body, { color: color.midnight }]}>{on ? '✓ ' : ''}{label}</Text>
  </Pressable>;
}
function Card({ title, sub, on, onPress, role = 'radio' }: { title: string; sub?: string; on: boolean; onPress: () => void; role?: 'radio' | 'checkbox' }) {
  return <Pressable accessibilityRole={role} accessibilityState={{ checked: on }} onPress={onPress}
    style={{ flex: role === 'radio' ? 1 : undefined, minHeight: 48, padding: space[3], gap: 2, borderRadius: radius.md, borderWidth: 1.5, borderColor: on ? color.blue : color.rule, backgroundColor: on ? color.blueSoft : color.ivoryRaised }}>
    <Text style={type.subhead}>{role === 'checkbox' ? (on ? '✓ ' : '+ ') : ''}{title}</Text>
    {sub ? <Text style={[type.sub, { color: color.midnightMuted }]}>{sub}</Text> : null}
  </Pressable>;
}
const Blue = ({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) =>
  <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: color.blue, borderRadius: radius.md, opacity: disabled ? 0.5 : 1 }}>
    <Text style={[type.button, { color: color.onBlue }]}>{label}</Text>
  </Pressable>;
const Link = ({ label, onPress }: { label: string; onPress: () => void }) =>
  <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={[type.button, { color: color.blue }]}>{label}</Text></Pressable>;

export default function Feel() {
  const client = useMemo(() => weddingReadClient(PREVIEW), []);
  const [a, setA] = useState<JourneyAnswers>(EMPTY);
  const [chosen, setChosen] = useState(false);
  const [page, setPage] = useState<{ read: WeddingRead; reason: ReadReason; remaining: number | null; limit: number } | null>(null);
  const [picks, setPicks] = useState<JourneyPick[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { store.read().then(saved => { if (saved) { setA(saved.answers); setChosen(true); setPicks(saved.picks); if (saved.read) setPage({ read: saved.read, reason: saved.reason, remaining: null, limit: 3 }); } }).catch(() => {}); }, []);
  const set = (patch: Partial<JourneyAnswers>) => setA(prev => ({ ...prev, ...patch }));
  const toggleMood = (m: string) => set({ moods: a.moods.includes(m) ? a.moods.filter(x => x !== m) : [...a.moods, m] });

  async function ask() {
    setBusy(true); setError('');
    const reply = await client.request(a);
    setBusy(false);
    if (!reply.ok) { setError(reply.message); return; }
    setPage({ read: reply.read, reason: reply.reason, remaining: reply.remaining, limit: reply.limit }); setPicks([]);
    await store.save({ answers: a, read: reply.read, reason: reply.reason, picks: [] }).catch(() => {});
  }
  async function keep() {
    setBusy(true); setError('');
    try {
      await savedProgress.update(p => applyPicks(p, picks, a.venueBooked, new Date().toISOString()));
      await store.save({ answers: a, read: page?.read ?? null, reason: page?.reason ?? 'no_model', picks });
      router.push('/welcome');
    } catch { setError('Your picks could not be saved. Try again.'); }
    finally { setBusy(false); }
  }

  if (page) {
    const { read } = page;
    const groups = pickable(read, a.venueBooked);
    const toggle = (p: JourneyPick) => setPicks(prev => prev.some(x => x.key === p.key) ? prev.filter(x => x.key !== p.key) : [...prev, p]);
    return <PlannedScreen route="/feel"><View style={{ gap: space[4] }}>
      <Text style={type.label}>Your wedding</Text>
      <Text accessibilityRole="header" style={type.title}>{read.headline}</Text>
      <Text style={type.body}>{read.read}</Text>
      {read.colours.length > 0 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>{read.colours.map(c =>
        <View key={c.hex + c.name} style={{ alignItems: 'center', gap: 4, width: 64 }}><View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.hex, borderWidth: 1, borderColor: color.rule }} /><Text style={[type.sub, { textAlign: 'center' }]}>{c.name}</Text></View>)}</View> : null}
      {read.honest ? <View style={{ padding: space[3], borderRadius: radius.md, borderWidth: 1, borderColor: color.rule, backgroundColor: color.ivoryRaised }}><Text style={type.body}><Text style={type.subhead}>Worth knowing. </Text>{read.honest}</Text></View> : null}
      <Text style={type.section}>Tap what belongs in your wedding</Text>
      {([['The direction', groups.directions], [a.where.trim() ? 'Places near you that carry this feel' : 'Kinds of place that carry this feel', groups.venues], ['Ideas that fit', groups.ideas], ['The details', groups.details]] as const).map(([title, items]) => items.length > 0 ? <View key={title} style={{ gap: space[2] }}>
        <Text style={type.subhead}>{title}</Text>
        {items.map(item => <Card key={item.pick.key} role="checkbox" title={item.label || item.sub} sub={item.label ? item.sub : undefined} on={picks.some(p => p.key === item.pick.key)} onPress={() => toggle(item.pick)} />)}
      </View> : null)}
      {read.ask.length > 0 ? <View style={{ gap: space[1] }}><Text style={type.subhead}>What to ask</Text>{read.ask.map(q => <Text key={q} style={type.body}>• {q}</Text>)}</View> : null}
      <Text style={[type.sub, { color: color.midnightMuted }]}>{readLabel(read.by, page.reason)}</Text>
      {error ? <Text accessibilityRole="alert" style={[type.body, { color: color.redPen }]}>{error}</Text> : null}
      <Blue label={picks.length ? `Continue to my date with ${picks.length} pick${picks.length === 1 ? '' : 's'} ›` : 'Continue to my date ›'} onPress={keep} disabled={busy} />
      <Link label={`‹ Change my answers${typeof page.remaining === 'number' ? ` (${page.remaining} of ${page.limit} left today)` : ''}`} onPress={() => { setPage(null); setError(''); }} />
    </View></PlannedScreen>;
  }

  return <PlannedScreen route="/feel"><View style={{ gap: space[4] }}>
    <Text style={type.label}>Free · no account · no email</Text>
    <Text accessibilityRole="header" style={type.display}>What should your wedding feel like?</Text>
    <Text style={type.body}>An AI planner describes your wedding. What you keep becomes your dated plan.</Text>
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: space[3] }}>
      <Card title="I have an idea" sub="Say it in your own words" on={chosen && a.path === 'idea'} onPress={() => { set({ path: 'idea' }); setChosen(true); }} />
      <Card title="I don’t know yet" sub="Tap a few things you like" on={chosen && a.path === 'dk'} onPress={() => { set({ path: 'dk' }); setChosen(true); }} />
    </View>
    {chosen && a.path === 'idea' ? <TextInput accessibilityLabel="The wedding you picture" multiline maxLength={600} value={a.wish} onChangeText={wish => set({ wish })}
      placeholder="For example: an Italian villa feel, long tables, lemons, for about 100"
      placeholderTextColor={color.midnightMuted}
      style={[type.body, { minHeight: 110, textAlignVertical: 'top', padding: space[3], borderWidth: 1.5, borderColor: color.rule, borderRadius: radius.md, backgroundColor: color.ivoryRaised, color: color.midnight }]} /> : null}
    {chosen ? <>
      {([['When in the year?', SEASONS, a.season, (v: string) => set({ season: a.season === v ? '' : v })], ['Inside or out?', SETTINGS, a.setting, (v: string) => set({ setting: a.setting === v ? '' : v })]] as const).map(([q, list, value, pick]) =>
        <View key={q} style={{ gap: space[2] }}><Text style={type.subhead}>{q}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>{list.map(v => <Chip key={v} label={v} on={value === v} onPress={() => pick(v)} />)}</View></View>)}
      <View style={{ gap: space[2] }}><Text style={type.subhead}>The feel (tap any)</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>{MOODS.map(m => <Chip key={m} label={m} on={a.moods.includes(m)} onPress={() => toggleMood(m)} />)}</View></View>
      <View style={{ gap: space[2] }}>
        <Text style={type.subhead}>If you know them (optional)</Text>
        <TextInput accessibilityLabel="Where (city or area)" value={a.where} maxLength={60} onChangeText={where => set({ where })} placeholder="Where (city or area)" placeholderTextColor={color.midnightMuted} style={[type.body, { minHeight: 48, paddingHorizontal: space[3], borderWidth: 1.5, borderColor: color.rule, borderRadius: radius.md, backgroundColor: color.ivoryRaised, color: color.midnight }]} />
        <TextInput accessibilityLabel="About how many guests" value={a.guests} keyboardType="number-pad" maxLength={4} onChangeText={guests => set({ guests: guests.replace(/[^0-9]/g, '') })} placeholder="About how many guests" placeholderTextColor={color.midnightMuted} style={[type.body, { minHeight: 48, paddingHorizontal: space[3], borderWidth: 1.5, borderColor: color.rule, borderRadius: radius.md, backgroundColor: color.ivoryRaised, color: color.midnight }]} />
        <Chip label="The venue is already booked" on={a.venueBooked} onPress={() => set({ venueBooked: !a.venueBooked })} />
      </View>
      <Text style={[type.sub, { color: color.midnightMuted }]}>What you tell us goes to a free AI model (Google Gemini or OpenRouter), which may use it to improve its products. Leave out names.</Text>
      {error ? <Text accessibilityRole="alert" style={[type.body, { color: color.redPen }]}>{error}</Text> : null}
      {busy ? <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}><ActivityIndicator color={color.blue} /><Text style={type.body}>Writing your wedding. This takes a few seconds.</Text></View> : null}
      <Blue label="Show me my wedding ›" onPress={ask} disabled={busy || (a.path === 'idea' && !a.wish.trim())} />
    </> : null}
    <Link label="I already know what I want. Just give me my plan ›" onPress={() => router.push('/welcome')} />
  </View></PlannedScreen>;
}
