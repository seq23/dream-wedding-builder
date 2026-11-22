import { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { TypingBox, flushFields, useTypedState } from '../../../src/TypingBox';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { getRandomBytes } from 'expo-crypto';
import { bytesToHex } from '@noble/ciphers/utils.js';
import { checkout, checkoutRead, checkoutCatalog } from '../../../src/billing/checkout';
import { downloadStore, EXTRA_DOWNLOAD_MESSAGE } from '../../../src/billing/downloadStore';
import { dateStore } from '../../../src/weddingDate';
import { sharingChanged } from '../../../src/sharing/runtime';
import { PlannedScreen } from '../../../src/ui';
import { buyButtonLabel, initialChoice, offersFor, OFFER_DETAIL, OFFER_TAG, PRICE_PROMISE, type ProductId } from '../../../src/billing/offers';
import type { StoreProduct } from '../../../src/billing/provider';
import { purchases } from '../../../src/billing/current';
import { defaultEventName, eventNameStore } from '../../../src/billing/eventName';
import { eventStore } from '../../../src/billing/eventStore';
import { offerEntitlementsFor, unusedNewEvents } from '../../../src/billing/events';
import { newEventDate } from '../../../src/billing/newEvent';
import { phoneSharing } from '../../../src/sharing/runtime';
import { syncReminders } from '../../../src/localReminders';
import { color, type, space, radius } from '../../../src/theme';
import { PREVIEW, PREVIEW_NOTE, STORE_AWAY } from '../../../src/build';
import { PRODUCTS, OFFER_NAME } from '../../../src/billing/offers';
import { fullPlanLines } from '../../../src/sharingSwitch';
import { REVIEW_BUTTON, REVIEW_LINK, REVIEW_MESSAGES, redeemReviewCode, reviewCodeAllowed, reviewWindowOpen } from '../../../src/billing/review';
const phoneCheckout = checkout(AsyncStorage, purchases, downloadStore(AsyncStorage), () => bytesToHex(getRandomBytes(16)));
export default function FullPlan() {
  const { newEvent: requestedNewEvent, date: requestedDate } = useLocalSearchParams<{ newEvent?: string; date?: string }>();
  const newEvent = requestedNewEvent === '1';
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [offers, setOffers] = useState<ProductId[]>([]);
  const [selected, setSelected] = useState<ProductId>();
  const [name, setName, nameNow] = useTypedState('');
  const [defaultName, setDefaultName] = useState('');
  const [locked, setLocked] = useState(false);
  const [paidUnused, setPaidUnused] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [buying, setBuying] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  // Google Play's reviewer only: Android, store build, unpaid, window open on the server (src/billing/review.ts).
  const [reviewWindow, setReviewWindow] = useState(false);
  const [reviewExpanded, setReviewExpanded] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewCode, setReviewCode, reviewCodeNow] = useTypedState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoaded(false); setProducts([]); setError(''); setMessage(''); setReviewWindow(false);
    const timeout = setTimeout(() => {
      active = false;
      setError('Your event took too long to load. Close this screen and try again.');
    }, 10000);
    dateStore(AsyncStorage).read().then(d => { if (active) setDefaultName(defaultEventName(newEvent ? newEventDate(requestedDate, d) : d)); }).catch(() => {});
    Promise.all([eventNameStore(AsyncStorage, newEvent).read(), eventStore(AsyncStorage).read(), eventStore(AsyncStorage).active()])
      .then(async ([draft, ledger, event]) => {
        if (!active) return;
        clearTimeout(timeout);
        const next = offersFor(offerEntitlementsFor(ledger, event?.id ?? ''), newEvent && ledger.firstEventId !== null);
        setName(draft.name); setLocked(draft.locked); setOffers(next); setSelected(initialChoice(next)); setPaidUnused(unusedNewEvents(ledger).length); setLoaded(true);
        if (reviewCodeAllowed(Platform.OS, purchases.available, draft.locked, newEvent)) void reviewWindowOpen().then(open => { if (active) setReviewWindow(open); });
        if (ledger.purchasedExtras?.some(extra => !ledger.extras.includes(extra))) setMessage(EXTRA_DOWNLOAD_MESSAGE);
        // Event details are ready: Restore does not depend on store prices.
        const catalog = await checkoutCatalog(purchases, next[0] === 'dw_new_event' ? 'new_event' : event?.fullPlan ? 'after_unlock' : 'default');
        if (!active) return;
        setProducts(catalog.products);
        if (catalog.error) setError(catalog.error);
      }).catch(() => { clearTimeout(timeout); if (active) setError('Could not read your event. Close this screen and try again.'); });
    return () => { active = false; clearTimeout(timeout); };
  }, [newEvent]));
  async function transact(kind: 'buy' | 'restore' | 'review' = 'buy') {
    const restore = kind !== 'buy';
    setSaving(true); setBuying(!restore); setError(''); setMessage(''); setReviewNote('');
    try {
      // The name box hands up its last letters before the store sheet reads it.
      await flushFields();
      const typedName = nameNow();
      const saved = await checkoutRead(() => dateStore(AsyncStorage).read());
      const buyingNewEvent = !restore && selected === 'dw_new_event';
      // The date she asked for when starting a new event, else the current one.
      // No date is fine: "I don't have a date yet" is an offered path, and she adds it any time after.
      const date = (buyingNewEvent ? newEventDate(requestedDate, saved) : saved) ?? '';
      if (buyingNewEvent && await checkoutRead(async () => (await phoneSharing()).read())) throw Error('Stop sharing your current event first (More, then Two phones). Then start the new event.');
      // Buying never waits on a name: an empty one becomes "Our wedding – <date>" (or "Our wedding"), renamed any time after.
      const eventName = typedName.trim() || defaultEventName(date);
      if (kind === 'review') {
        // The code is checked on the server; then the purchase door verifies and delivers, exactly as for Restore.
        const result = await redeemReviewCode(reviewCodeNow(), await purchases.appUserId().catch(() => null));
        if (result !== 'unlocked') throw Error(REVIEW_MESSAGES[result]);
        await phoneCheckout.review(eventName, date);
        setReviewWindow(false);
      } else if (restore) await phoneCheckout.restore(eventName, date);
      else {
        if (!selected) throw Error('Choose a product first.');
        await phoneCheckout.purchase(eventName, date, selected);
      }
      sharingChanged();
      const downloaded = await checkoutRead(() => downloadStore(AsyncStorage).saved());
      const [event, ledger] = await checkoutRead(() => Promise.all([eventStore(AsyncStorage).active(), eventStore(AsyncStorage).read()]));
      const unused = unusedNewEvents(ledger).length;
      setPaidUnused(unused);
      if (buyingNewEvent) {
        // The new event is now the open one: its reminders follow its date.
        await syncReminders().catch(() => {});
        setMessage(`Your new event is ready: ${event?.name ?? eventName}. Open your plan to see it.`);
        setOffers([]); setSelected(undefined); setProducts([]); setName(event?.name ?? eventName); setLocked(true);
        return;
      }
      if (newEvent) {
        // Restore on the new-event screen: the name typed here is still for the new event.
        setMessage(unused ? 'Restored. Your new event is already paid for. Start it below at no extra charge.' : 'Restored. No unstarted event was found for this store account.');
        return;
      }
      setLocked(true);
      setMessage(downloaded?.warning ?? (unused ? `Your full plan is saved on this phone. You also have ${unused === 1 ? 'a paid event' : `${unused} paid events`} not started yet: use Start a new event in More, at no extra charge.` : 'Your full plan is saved on this phone.'));
      if (event) setName(event.name);
      setOffers(offersFor(offerEntitlementsFor(ledger, event?.id ?? '')));
      setSelected(undefined);
      setProducts([]);
      try { setProducts(await checkoutRead(() => purchases.products('after_unlock'))); }
      catch { setMessage('Your full plan is saved. Reopen this screen to load store prices for extras.'); }
    } catch (e) {
      const text = e instanceof Error ? e.message : 'Could not check your purchase. Restore and try again.';
      // A review-code message sits right under "Use this code", like a buying message under the buy button.
      if (kind === 'review') setReviewNote(text); else setError(text);
    }
    finally { setSaving(false); setBuying(false); }
  }
  // An event already paid for and not started needs no store price: it is not charged again.
  const prepaid = selected === 'dw_new_event' && paidUnused > 0;
  const canBuy = purchases.available && loaded && !saving && !!selected && offers.includes(selected) && (prepaid || products.some(p => p.id === selected));
  async function saveName() {
    setSaving(true); setError(''); setMessage('');
    try {
      await flushFields();
      const saved = await eventNameStore(AsyncStorage, newEvent).save(nameNow());
      setName(saved);
      // A paid, shared plan: the partner's phone shows the new name too.
      if (locked) { const api = await phoneSharing(); const session = await api.read(); if (session?.role === 'owner') await api.updateOwnerEvent({ ...session.plan.event, name: saved }); sharingChanged(); }
      setMessage(locked ? 'Wedding name changed.' : 'Event name saved on this phone.');
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save your event name. Please try again.'); }
    finally { setSaving(false); }
  }
  return <PlannedScreen route="/more/full-plan">
    <Text accessibilityRole="header" style={type.title}>{newEvent ? 'A new wedding event' : 'What the full plan adds'}</Text>
    <Text style={type.body}>{PRICE_PROMISE}</Text>
    <View style={{ gap: space[2] }}>
      {fullPlanLines().map(line => <Text key={line} style={type.body}>• {line}</Text>)}
    </View>
    {!purchases.available ? <Text accessibilityRole="status" style={type.sub}>{PREVIEW ? PREVIEW_NOTE : STORE_AWAY}</Text> : null}
    {newEvent ? <Text style={type.body}>A new event is a new full plan, paid once, with its own name and date. Everything you have ticked and added stays on this phone.</Text> : null}
    {newEvent && paidUnused > 0 ? <Text accessibilityRole="status" style={type.body}>You have already paid for this event. Starting it costs nothing more.</Text> : null}
    {loaded ? <View style={{ gap: space[2] }}>
      <Text style={type.subhead}>{locked ? 'Your wedding’s name' : 'Name this wedding (optional)'}</Text>
      <TypingBox accessibilityLabel="Name this wedding (optional)" placeholder={defaultName || 'Our wedding'} placeholderTextColor={color.midnightMuted} value={name} onChangeText={value => { setName(value); setMessage(''); }} maxLength={140} editable={!saving} style={[type.body, { borderWidth: 1, borderColor: color.rule, borderRadius: radius.md, padding: space[3] }]} />
      <Text style={type.sub}>{locked ? 'The name goes on your full plan and the printed packet. Change it any time.' : `The name goes on your full plan and the printed packet. Leave it empty and it is called “${defaultName || 'Our wedding'}”. You can change it any time, before or after you buy.`}</Text>
      {name.trim() ? <Pressable accessibilityRole="button" disabled={saving} onPress={() => { void saveName(); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[type.button, { color: color.blue }]}>{locked ? 'Save the new name ›' : 'Save this name ›'}</Text></Pressable> : null}
    </View> : null}
    {message ? <Text accessibilityRole="status" style={type.sub}>{message}</Text> : null}
    {offers.map(id => <Pressable key={id} accessibilityRole="radio" aria-checked={selected === id} onPress={() => setSelected(id)}
      style={{ minHeight: 64, padding: space[3], borderRadius: radius.md, borderWidth: selected === id ? 2 : 1, borderColor: selected === id ? color.blue : color.rule, gap: space[1] }}>
      {OFFER_TAG[id] ? <Text style={[type.label, { color: color.blue }]}>{OFFER_TAG[id]}</Text> : null}
      <Text style={type.button}>{OFFER_NAME[id]}</Text>
      <Text style={type.sub}>{OFFER_DETAIL[id]}</Text>
      <Text style={type.sub}>{id === 'dw_new_event' && paidUnused > 0 ? 'Already paid' : products.find(p => p.id === id)?.price ?? (PREVIEW ? `$${PRODUCTS[id].priceUsd.toFixed(2)}, paid once` : 'Loading the price…')}</Text>
    </Pressable>)}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canBuy }} disabled={!canBuy} onPress={() => { void transact(); }}
      style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: color.blue, borderRadius: radius.md, opacity: canBuy ? 1 : 0.5 }}>
      <Text style={[type.button, { color: color.onBlue }]}>{buyButtonLabel({ available: purchases.available, preview: PREVIEW, selected, name: selected ? OFFER_NAME[selected] : '', price: products.find(p => p.id === selected)?.price, buying, storeName: Platform.OS === 'android' ? 'Google Play store' : 'App Store' })}</Text>
    </Pressable>
    {/* Any message about buying sits right under the button she tapped, never scrolled away. */}
    {error ? <Text accessibilityRole="alert" style={{ color: color.redPen }}>{error}</Text> : null}
    {purchases.available ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving || !loaded }} disabled={saving || !loaded} onPress={() => { void transact('restore'); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[type.button, { color: color.blue }]}>I already bought this: restore it ›</Text></Pressable> : null}
    {reviewWindow && !locked ? (reviewExpanded ? <View style={{ gap: space[2] }}>
      <Text style={type.subhead}>App review code</Text>
      <TypingBox accessibilityLabel="App review code" placeholder="10 digits" placeholderTextColor={color.midnightMuted} keyboardType="number-pad" maxLength={10}
        clean={raw => raw.replace(/\D/g, '').slice(0, 10)} value={reviewCode} onChangeText={value => { setReviewCode(value); setReviewNote(''); }} editable={!saving}
        style={[type.body, { borderWidth: 1, borderColor: color.rule, borderRadius: radius.md, padding: space[3] }]} />
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving }} disabled={saving} onPress={() => { void transact('review'); }} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={[type.button, { color: color.blue }]}>{REVIEW_BUTTON} ›</Text>
      </Pressable>
      {reviewNote ? <Text accessibilityRole="alert" style={{ color: color.redPen }}>{reviewNote}</Text> : null}
    </View> : <Pressable accessibilityRole="button" onPress={() => setReviewExpanded(true)} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={[type.sub, { color: color.midnightMuted }]}>{REVIEW_LINK}</Text>
    </Pressable>) : null}
    <View style={{ flexDirection: 'row', gap: space[4] }}>
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL('https://weddingchecklistpdf.com/terms')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={type.sub}>Terms</Text></Pressable>
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL('https://weddingchecklistpdf.com/privacy')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={type.sub}>Privacy</Text></Pressable>
    </View>
  </PlannedScreen>;
}
