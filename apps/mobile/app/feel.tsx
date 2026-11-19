import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { TypingBox, flushFields, useTypedState } from '../src/TypingBox';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlannedScreen } from '../src/ui';
import { ReportAnswer } from '../src/ReportAnswerLink';
import { PREVIEW, partOfFullPlan } from '../src/build';
import { savedDate } from '../src/savedDate';
import { savedProgress } from '../src/savedProgress';
import { useFullPlanPrice } from '../src/useFullPlanPrice';
import { WeddingDatePicker } from '../src/WeddingDatePicker';
import { canSaveDate } from '../src/welcomeStart';
import { MAX_PHOTOS, pickPhoto, type JourneyPhoto } from '../src/photos';
import { BUDGETS, COLOURS_NOT_SURE, EMPTY_ANSWERS, LOVES, MOODS, READ_FAILED, SEASONS, SETTINGS, TRADITIONS, WEDDING_COLOURS, answersToSend, applyPicks, applyTradition, colourView, journeyStore, pickable, placePicks, quotaNote, readLabel, toggleColour, togglePick, toggleTradition, traditionList, weddingReadClient,
  type JourneyAnswers, type JourneyPick, type ReadReason, type WeddingRead } from '../src/journey';
import { color, font, radius, space, type } from '../src/theme';
import { detailStore, journeyDetails } from '../src/draftReview';
import { localToday, plainDate } from '@core/dated-plan';
import { dateCheck } from '../src/welcomeStart';

// The free journey, as the approved sample and the website (components/WeddingJourney.tsx):
// 1 Tell us · 2 See it · 3 Keep · 4 Plan, one blue "Continue · step N of 4 ›" per step.
// The first screen for someone new; the Plan tab's "Your wedding ›" card reopens step 2.
const store = journeyStore(AsyncStorage);
const STEPS = ['Tell us', 'See it', 'Keep', 'Plan'];
type Step = 1 | 2 | 3 | 4;
interface Page { read: WeddingRead; reason: ReadReason; remaining: number | null; limit: number }

const mono = { fontFamily: font.mono, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase' as const, color: color.midnightMuted };
const h1 = { fontFamily: font.serif, fontSize: 33, lineHeight: 37, color: color.midnight };
const h2 = { fontFamily: font.serif, fontSize: 23, lineHeight: 27, color: color.midnight };
const box = { borderWidth: 1, borderColor: color.rule, borderRadius: radius.md, backgroundColor: color.ivoryRaised, padding: space[3] };
const input = [type.body, { minHeight: 48, paddingHorizontal: space[3], borderWidth: 1, borderColor: color.rule, borderRadius: radius.md, backgroundColor: color.ivoryRaised, color: color.midnight }];

function Progress({ step }: { step: Step }) {
  return <View accessibilityLabel={`Step ${step} of 4: ${STEPS[step - 1]}`} style={{ gap: 6 }}>
    <View style={{ flexDirection: 'row', gap: 6 }}>{STEPS.map((s, i) => <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < step ? color.blue : color.rule }} />)}</View>
    <View style={{ flexDirection: 'row', gap: 6 }}>{STEPS.map(s => <Text key={s} style={[mono, { flex: 1, fontSize: 10 }]}>{s}</Text>)}</View>
  </View>;
}
// Chips say whether they are chosen to VoiceOver and TalkBack: a pick-any row is a set of
// checkboxes, a pick-one row a set of radios (first-time test, 14 Nov 2026).
function Chip({ label, on, onPress, many = false }: { label: string; on: boolean; onPress: () => void; many?: boolean }) {
  return <Pressable accessibilityRole={many ? 'checkbox' : 'radio'} accessibilityState={{ checked: on, selected: on }} accessibilityLabel={label} onPress={onPress}
    style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: radius.pill, borderWidth: on ? 2 : 1, borderColor: on ? color.blue : color.rule, backgroundColor: color.ivoryRaised }}>
    <Text style={[type.sub, { fontFamily: font.sansBold, color: color.midnight }]}>{label}</Text>
  </Pressable>;
}
/** A chip with the color itself beside its name (step 1, "Your colors"). */
function ColourChip({ label, hex, on, onPress }: { label: string; hex?: string; on: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on, selected: on }} accessibilityLabel={label} onPress={onPress}
    style={{ minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.pill, borderWidth: on ? 2 : 1, borderColor: on ? color.blue : color.rule, backgroundColor: color.ivoryRaised }}>
    {hex ? <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: hex, borderWidth: 1, borderColor: color.rule }} /> : null}
    <Text style={[type.sub, { fontFamily: font.sansBold, color: color.midnight }]}>{label}</Text>
  </Pressable>;
}
function Tick({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={onPress} style={{ minHeight: 44, flexDirection: 'row', gap: space[2], alignItems: 'center' }}>
    <View style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: on ? color.blue : color.midnightMuted, backgroundColor: on ? color.blue : color.ivoryRaised, alignItems: 'center', justifyContent: 'center' }}>{on ? <Text style={{ color: color.onBlue, fontSize: 14, lineHeight: 16 }}>✓</Text> : null}</View>
    <Text style={[type.body, { flex: 1 }]}>{label}</Text>
  </Pressable>;
}
const Row = ({ title, children }: { title: string; children: React.ReactNode }) =>
  <View style={{ gap: space[2] }}><Text style={mono}>{title}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>{children}</View></View>;
const Swatches = ({ colours }: { colours: { name?: string; hex: string }[] }) =>
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space[3], rowGap: space[2] }}>{colours.map((c, i) =>
    <View key={`${c.hex}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c.hex, borderWidth: 1, borderColor: color.rule }} />{c.name ? <Text style={type.sub}>{c.name}</Text> : null}</View>)}</View>;
const Blue = ({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) =>
  <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={{ minHeight: 52, justifyContent: 'center', alignItems: 'center', backgroundColor: color.blue, borderRadius: 12, opacity: disabled ? 0.4 : 1 }}>
    <Text style={[type.button, { color: color.onBlue, fontSize: 17 }]}>{label}</Text>
  </Pressable>;
const Under = ({ label, onPress }: { label: string; onPress: () => void }) =>
  <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}><Text style={[type.body, { fontFamily: font.sansBold, textDecorationLine: 'underline' }]}>{label}</Text></Pressable>;

export default function Feel() {
  const client = useMemo(() => weddingReadClient(PREVIEW), []);
  const price = useFullPlanPrice();
  const [step, setStep] = useState<Step>(1);
  const [a, setA, answersNow] = useTypedState<JourneyAnswers>(EMPTY_ANSWERS);
  const [chosen, setChosen] = useState(false);
  const [photos, setPhotos] = useState<JourneyPhoto[]>([]);
  const [factsOpen, setFactsOpen] = useState(false);
  const [page, setPage] = useState<Page | null>(null);
  const [picks, setPicks] = useState<JourneyPick[]>([]);
  const [date, setDate] = useState('');
  const [savedOn, setSavedOn] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [askPast, setAskPast] = useState<{ date: string; then: '/plan' | '/more/packet' } | null>(null);
  useEffect(() => {
    store.read().then(saved => {
      if (!saved) return;
      setA(saved.answers); setChosen(true); setPicks(saved.picks);
      if (saved.read) { setPage({ read: saved.read, reason: saved.reason, remaining: null, limit: 3 }); setStep(2); }
    }).catch(() => {});
    savedDate.read().then(d => { setSavedOn(d); if (d && canSaveDate(d)) setDate(d); }).catch(() => {});
  }, []);
  const set = (patch: Partial<JourneyAnswers>) => setA(prev => ({ ...prev, ...patch }));
  // Leaving a step ends editing first, so the box's last letters are kept (flushFields).
  const go = (n: Step) => { void flushFields().then(() => { setError(''); setStep(n); }); };

  async function addPhoto() {
    setError('');
    try { const p = await pickPhoto(); if (p) setPhotos(list => list.length >= MAX_PHOTOS ? list : [...list, { ...p, id: `${p.id}-${list.length}` }]); }
    catch { setError('That photo could not be opened. Try another one.'); }
  }
  const updatePhoto = (id: string, change: Partial<JourneyPhoto>) => setPhotos(list => list.map(p => p.id === id ? { ...p, ...change } : p));

  async function ask() {
    setBusy(true); setError('');
    try {
      await flushFields();
      const a = answersNow();
      const sent = photos.map(p => ({ loves: p.loves, colours: p.colours }));
      const reply = await client.request(answersToSend(a, canSaveDate(date) ? date : ''), sent);
      if (!reply.ok) { setError(reply.message); return; }
      setPage({ read: reply.read, reason: reply.reason, remaining: reply.remaining, limit: reply.limit }); setPicks([]); setStep(2);
      await store.save({ answers: a, read: reply.read, reason: reply.reason, picks: [] }).catch(() => {});
    } catch { setError(READ_FAILED); }
    finally { setBusy(false); }
  }
  async function finish(chosenDate: string, then: '/plan' | '/more/packet' = '/plan', pastOk = false) {
    // A date that has passed is usually a typo in the year: ask before saving it.
    if (!pastOk && chosenDate !== savedOn && dateCheck(chosenDate) === 'past') { setAskPast({ date: chosenDate, then }); return; }
    setBusy(true); setError(''); setAskPast(null);
    try {
      await flushFields();
      const a = answersNow();
      const today = localToday();
      await savedProgress.update(p => applyTradition(applyPicks(p, placePicks(picks, chosenDate, today), a.venueBooked, new Date().toISOString()), a.tradition));
      if (chosenDate !== savedOn) await savedDate.save(chosenDate, today, true);
      await store.save({ answers: answersToSend(a, chosenDate), read: page?.read ?? null, reason: page?.reason ?? 'no_model', picks });
      // Guests, town and budget she gave here fill the Plan's details, so she never types them twice.
      const details = detailStore(AsyncStorage);
      await details.save(journeyDetails(await details.read().catch(() => ({})), a)).catch(() => {});
      router.replace('/plan');
      if (then !== '/plan') router.push(then);
    } catch {
      setError('Your plan could not be saved. Try again.');
    } finally { setBusy(false); }
  }

  const read = page?.read;
  const groups = read ? pickable(read, a.venueBooked) : null;
  const toggle = (p: JourneyPick) => setPicks(prev => togglePick(prev, p));
  const colourShown = read ? colourView(read) : null;
  const photoSwatches = photos.flatMap(p => p.colours).slice(0, 8).map(hex => ({ hex }));
  const err = error ? <Text accessibilityRole="alert" style={[type.body, { color: color.redPen, fontFamily: font.sansBold }]}>{error}</Text> : null;

  return <PlannedScreen route="/feel" scrollKey={step}><View style={{ gap: 18 }}>
    <Progress step={step} />

    {step === 1 ? <>
      <View style={{ gap: space[2] }}>
        <Text accessibilityRole="header" style={h1}>What should your wedding feel like?</Text>
        <Text style={type.body}>Free, with no account and no email.</Text>
      </View>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 10 }}>
        {([['idea', 'I have an idea', 'Say it in your own words'], ['dk', 'I don’t know yet', 'Tap a few things you like']] as const).map(([id, title, sub]) => {
          const on = chosen && a.path === id;
          return <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={title} onPress={() => { set({ path: id }); setChosen(true); }}
            style={{ flex: 1, gap: 4, padding: 14, borderRadius: 12, borderWidth: on ? 3 : 1.5, borderColor: on ? color.blue : color.rule, backgroundColor: color.ivoryRaised }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: on ? 6 : 1.5, borderColor: on ? color.blue : color.midnightMuted, marginBottom: 4 }} />
            <Text style={type.subhead}>{title}</Text><Text style={[type.sub, { color: color.midnightMuted }]}>{sub}</Text>
          </Pressable>;
        })}
      </View>
      {chosen && a.path === 'idea' ? <TypingBox accessibilityLabel="Your wedding in your own words" multiline maxLength={400} value={a.wish} onChangeText={wish => set({ wish })}
        placeholder="For example: an Italian villa feel, candlelit long tables, 100 people" placeholderTextColor={color.midnightMuted}
        style={[...input, { minHeight: 96, paddingTop: space[3], textAlignVertical: 'top' }]} /> : null}
      {chosen ? <View style={{ gap: space[2] }}>
        <Text style={mono}>Wedding date (optional)</Text>
        <WeddingDatePicker value={date} onChange={setDate} />
        {canSaveDate(date) ? <Text style={[type.sub, { color: color.midnightMuted }]}>{plainDate(date)}. The season comes from your date.</Text> : null}
      </View> : null}
      {chosen && a.path === 'dk' ? <View style={{ gap: space[4] }}>
        {!canSaveDate(date) ? <Row title="When">{SEASONS.map(v => <Chip key={v} label={v} on={a.season === v} onPress={() => set({ season: a.season === v ? '' : v })} />)}</Row> : null}
        <Row title="Where">{SETTINGS.map(v => <Chip key={v} label={v} on={a.setting === v} onPress={() => set({ setting: a.setting === v ? '' : v })} />)}</Row>
        <Row title="How it should feel (pick any)">{MOODS.map(m => <Chip key={m} many label={m} on={a.moods.includes(m)} onPress={() => set({ moods: a.moods.includes(m) ? a.moods.filter(x => x !== m) : [...a.moods, m] })} />)}</Row>
      </View> : null}
      {chosen ? <Row title="Your colors (pick any you already love)">
        {WEDDING_COLOURS.map(c => <ColourChip key={c.name} label={c.name} hex={c.hex} on={a.colours.includes(c.name)} onPress={() => set({ colours: toggleColour(a.colours, c.name) })} />)}
        <ColourChip label={COLOURS_NOT_SURE} on={!a.colours.length} onPress={() => set({ colours: toggleColour(a.colours, COLOURS_NOT_SURE) })} />
      </Row> : null}
      {chosen ? <View style={{ gap: space[2] }}>
        <Text style={mono}>Photos you love (optional, up to 3)</Text>
        {photos.map((p, i) => <View key={p.id} style={[box, { flexDirection: 'row', gap: 10 }]}>
          <Image accessibilityLabel={`Your photo ${i + 1}`} source={{ uri: p.uri }} style={{ width: 72, height: 72, borderRadius: 8 }} />
          <View style={{ flex: 1, gap: space[2] }}>
            <Text style={[type.sub, { color: color.midnightMuted }]}>What do you love in it?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{LOVES.map(l => <Chip key={l} many label={l} on={p.loves.includes(l)} onPress={() => updatePhoto(p.id, { loves: p.loves.includes(l) ? p.loves.filter(x => x !== l) : [...p.loves, l] })} />)}</View>
            <Swatches colours={p.colours.map(hex => ({ hex }))} />
            <Text style={[type.sub, { color: color.midnightMuted }]}>Photos stay on your phone; only the colors are used.</Text>
            <Under label="Remove this photo" onPress={() => setPhotos(list => list.filter(x => x.id !== p.id))} />
          </View>
        </View>)}
        {photos.length < MAX_PHOTOS ? <Under label="Add a photo ›" onPress={addPhoto} /> : null}
      </View> : null}
      {chosen ? <View style={box}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: factsOpen }} onPress={() => setFactsOpen(o => !o)} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={type.subhead}>{factsOpen ? '▾' : '▸'} If you already know some things</Text>
        </Pressable>
        {factsOpen ? <View style={{ gap: space[3], marginTop: space[2] }}>
          <TypingBox accessibilityLabel="Town or city" value={a.where} maxLength={60} onChangeText={where => set({ where })} placeholder="Town or city" placeholderTextColor={color.midnightMuted} style={input} />
          <TypingBox accessibilityLabel="About how many guests" value={a.guests} keyboardType="number-pad" clean={g => g.replace(/[^0-9]/g, '').slice(0, 4)} onChangeText={guests => set({ guests })} placeholder="About how many guests" placeholderTextColor={color.midnightMuted} style={input} />
          <Row title="Budget (optional)">{BUDGETS.map(v => <Chip key={v} label={v} on={a.budget === v} onPress={() => set({ budget: a.budget === v ? '' : v })} />)}</Row>
          <Row title="Traditions (optional, pick up to 3)">{TRADITIONS.map(v => <Chip key={v} many label={v} on={traditionList(a.tradition).includes(v)} onPress={() => set({ tradition: toggleTradition(a.tradition, v) })} />)}</Row>
          <Text style={mono}>Already decided</Text>
          <Tick label="The venue is booked" on={a.venueBooked} onPress={() => set({ venueBooked: !a.venueBooked })} />
        </View> : null}
      </View> : null}
      {chosen ? <Text style={[type.sub, { color: color.midnightMuted }]}>What you tell us goes to a free AI model (Google Gemini or OpenRouter), which may use it to improve its products. We remove emails, phone numbers, street addresses and links first. Photos stay on your phone; only the colors are used. Leave out names.</Text> : null}
      {err}
      {busy ? <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}><ActivityIndicator color={color.blue} /><Text style={type.body}>Reading your wedding. This takes a few seconds.</Text></View> : null}
      <Blue label={busy ? 'Reading your wedding…' : 'Continue · step 1 of 4 ›'} onPress={ask} disabled={!chosen || busy} />
      <Under label="I already know what I want. Just give me my plan ›" onPress={() => go(4)} />
    </> : null}

    {step === 2 && read ? <>
      <Text style={mono}>Your wedding, described</Text>
      <Text accessibilityRole="header" style={h1}>{read.headline}</Text>
      <Text style={type.body}>{read.read}</Text>
      {read.photoNotes.map((n, i) => <Text key={i} style={type.sub}><Text style={{ fontFamily: font.sansBold }}>From your photo: </Text>{n}</Text>)}
      <View style={{ gap: space[2] }}>
        {colourShown?.mode === 'yours' ? <>
          <Text style={mono}>Your colors</Text><Swatches colours={colourShown.yours} />
          {colourShown.goesWith.length ? <><Text style={[mono, { marginTop: space[2] }]}>Goes with yours</Text><Swatches colours={colourShown.goesWith} /></> : null}
        </> : colourShown?.mode === 'ideas' && colourShown.ideas.length ? <>
          <Text style={mono}>Color ideas to try</Text>
          {colourShown.ideas.map(i => <View key={i.name} style={{ gap: 6 }}><Text style={[type.sub, { fontFamily: font.sansBold }]}>{i.name}</Text><Swatches colours={i.colours} /></View>)}
        </> : null}
        {photoSwatches.length ? <><Text style={[mono, { marginTop: space[2] }]}>From your photos, read on this phone</Text><Swatches colours={photoSwatches} /></> : null}
      </View>
      {read.directions.length ? <View style={{ gap: space[2] }}><Text style={h2}>Two directions</Text>{read.directions.map(d => <View key={d.name} style={box}><Text style={type.subhead}>{d.name}</Text><Text style={type.body}>{d.what}</Text></View>)}</View> : null}
      {a.venueBooked ? <View style={box}><Text style={type.body}>You said your venue is booked, so no venue types are suggested.</Text></View>
        : read.venueTypes.length ? <View style={{ gap: space[2] }}>
          <Text style={h2}>{a.where.trim() ? 'Places near you that carry this feel' : 'Kinds of place that carry this feel'}</Text>
          {read.venueTypes.map(v => <Text key={v.id} style={type.body}>• <Text style={{ fontFamily: font.sansBold }}>{v.name}.</Text> {v.why}</Text>)}
          <Text style={[type.sub, { color: color.midnightMuted }]}>Kinds of place to look for, not named venues.</Text>
        </View> : null}
      {read.ideas.length ? <View style={{ gap: space[2] }}>
        <Text style={h2}>Ideas that fit</Text><Text style={[type.sub, { color: color.midnightMuted }]}>Chosen from our 175 standout ideas, from what you told us.</Text>
        {read.ideas.map(i => <Text key={i.id} style={type.body}>• <Text style={{ fontFamily: font.sansBold }}>{i.name}</Text> <Text style={[mono, { fontSize: 10 }]}>{i.cost}</Text>{'\n'}{i.why}</Text>)}
      </View> : null}
      {read.ask.length ? <View style={{ gap: space[2] }}><Text style={h2}>What to ask</Text>{read.ask.map(q => <Text key={q} style={type.body}>• {q}</Text>)}</View> : null}
      {read.honest ? <View style={box}><Text style={type.body}><Text style={{ fontFamily: font.sansBold }}>Worth knowing. </Text>{read.honest}</Text></View> : null}
      <Text style={[type.sub, { color: color.midnightMuted }]}>{readLabel(read.by, page!.reason)}</Text>
      <ReportAnswer where="Your wedding, described" answer={[read.headline, read.read, ...read.directions.map(d => `${d.name}: ${d.what}`), ...read.ideas.map(i => `${i.name}: ${i.why}`), ...read.ask, read.honest ?? ''].filter(Boolean).join('\n')} />
      <Blue label="Continue · step 2 of 4 ›" onPress={() => go(3)} />
      <Under label="‹ Change my answers" onPress={() => go(1)} />
      {quotaNote(page!.remaining) ? <Text style={[type.sub, { color: color.midnightMuted }]}>{quotaNote(page!.remaining)}</Text> : null}
    </> : null}

    {step === 3 && read && groups ? <>
      <Text style={mono}>Keep what you love</Text>
      <Text accessibilityRole="header" style={h1}>Tap what belongs in your wedding.</Text>
      {groups.colours.length ? <View style={{ gap: space[2] }}>
        <Text style={h2}>The colors</Text>
        <Text style={[type.sub, { color: color.midnightMuted }]}>Keep one, or none: nothing is decided for you.</Text>
        {groups.colours.map(item => { const on = picks.some(p => p.key === item.pick.key); return <Pressable key={item.pick.key} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${item.label}: ${item.sub}`} onPress={() => toggle(item.pick)}
          style={[box, { gap: 6, borderWidth: on ? 2 : 1, borderColor: on ? color.blue : color.rule }]}>
          <Text style={type.subhead}>{item.label}</Text><Swatches colours={item.colours} />
          {on ? <Text style={[mono, { color: color.done }]}>✓ Kept</Text> : null}
        </Pressable>; })}
      </View> : null}
      {([['The direction', groups.directions], ['The kind of place', groups.venues], ['The ideas', groups.ideas], ['The details', groups.details]] as const).map(([title, items]) => items.length ? <View key={title} style={{ gap: space[2] }}>
        <Text style={h2}>{title}</Text>
        {items.map(item => { const on = picks.some(p => p.key === item.pick.key); return <Pressable key={item.pick.key} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggle(item.pick)}
          style={[box, { gap: 4, borderWidth: on ? 2 : 1, borderColor: on ? color.blue : color.rule }]}>
          {item.label ? <Text style={type.subhead}>{item.label}</Text> : null}<Text style={type.body}>{item.sub}</Text>
          {on ? <Text style={[mono, { color: color.done }]}>✓ Kept</Text> : null}
        </Pressable>; })}
      </View> : null)}
      <Text style={[type.sub, { color: color.midnightMuted }]}>Each one you keep becomes a dated task in your plan, marked “Your pick”.{a.venueBooked ? ' Your venue is booked, so the venue task is ticked off.' : ''}</Text>
      <Blue label="Continue · step 3 of 4 ›" onPress={() => go(4)} />
      <Under label="‹ Back to my wedding" onPress={() => go(2)} />
    </> : null}

    {step === 4 ? <>
      <Text style={mono}>Your dated plan</Text>
      <Text accessibilityRole="header" style={h1}>When is it?</Text>
      <WeddingDatePicker value={date} onChange={setDate} />
      {!canSaveDate(date) ? <Under label="I don’t have a date yet ›" onPress={() => finish('')} /> : null}
      {askPast ? <View accessibilityRole="alert" style={[box, { gap: space[2] }]}>
        <Text style={type.subhead}>Is that right?</Text>
        <Text style={type.body}>{plainDate(askPast.date)} has already passed. If you meant next year, change the year.</Text>
        <Blue label="Yes, that’s right ›" onPress={() => finish(askPast.date, askPast.then, true)} />
        <Under label="Change the date" onPress={() => setAskPast(null)} />
      </View> : null}
      {err}
      <Blue label={busy ? 'Saving your plan…' : 'Continue · step 4 of 4 ›'} onPress={() => finish(date)} disabled={!canSaveDate(date) || busy} />
      <View style={[box, { gap: 4 }]}>
        <Text style={type.subhead}>Your plan</Text>
        <Text style={type.body}>{picks.length ? `Every task with a real date, and your ${picks.length} pick${picks.length === 1 ? '' : 's'} marked “Your pick”. Free.` : 'Every task with a real date. Free.'}</Text>
        <Text style={type.subhead}>Payments, your wedding-week sheet and the hand-over packet</Text>
        <Text style={[type.sub, { color: color.midnightMuted }]}>{partOfFullPlan(price)}. Your plan above stays free.</Text>
      </View>
      <View style={[box, { gap: 4 }]}>
        <Text style={type.body}><Text style={{ fontFamily: font.sansBold }}>Want this sent to you? </Text>Print it, or send it to yourself from your phone’s share sheet. We never ask for your email.</Text>
        <Under label="Send me my plan ›" onPress={() => finish(canSaveDate(date) ? date : '', '/more/packet')} />
      </View>
      <Under label={read ? '‹ Change what I kept' : '‹ Back to step 1'} onPress={() => go(read ? 3 : 1)} />
    </> : null}
  </View></PlannedScreen>;
}
