import { useCallback, useState } from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { getRandomBytes } from 'expo-crypto';
import { bytesToHex } from '@noble/ciphers/utils.js';
import { checkout, checkoutRead, checkoutCatalog } from '../../../src/billing/checkout';
import { downloadStore, EXTRA_DOWNLOAD_MESSAGE } from '../../../src/billing/downloadStore';
import { dateStore } from '../../../src/weddingDate';
import { sharingChanged } from '../../../src/sharing/runtime';
import { PlannedScreen } from '../../../src/ui';
import { offersFor, type ProductId } from '../../../src/billing/offers';
import type { StoreProduct } from '../../../src/billing/provider';
import { purchases } from '../../../src/billing/current';
import { eventNameStore } from '../../../src/billing/eventName';
import { eventStore } from '../../../src/billing/eventStore';
import { offerEntitlementsFor, unusedNewEvents } from '../../../src/billing/events';
import { newEventDate } from '../../../src/billing/newEvent';
import { phoneSharing } from '../../../src/sharing/runtime';
import { syncReminders } from '../../../src/localReminders';
import { color, type, space, radius } from '../../../src/theme';
import { PREVIEW, PREVIEW_NOTE, STORE_AWAY } from '../../../src/build';
import { PRODUCTS } from '../../../src/billing/offers';
const phoneCheckout = checkout(AsyncStorage, purchases, downloadStore(AsyncStorage), () => bytesToHex(getRandomBytes(16)));
const names: Record<ProductId, string> = { dw_planner_printables: 'Planner + printables', dw_full_plan: 'Full plan', dw_printables_topup: 'Printables', dw_day_of_kit: 'Day-of kit', dw_new_event: 'Full plan for a new event' };
export default function FullPlan() {
  const { newEvent: requestedNewEvent, date: requestedDate } = useLocalSearchParams<{ newEvent?: string; date?: string }>();
  const newEvent = requestedNewEvent === '1';
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [offers, setOffers] = useState<ProductId[]>([]);
  const [selected, setSelected] = useState<ProductId>();
  const [name, setName] = useState('');
  const [locked, setLocked] = useState(false);
  const [paidUnused, setPaidUnused] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoaded(false); setProducts([]); setError(''); setMessage('');
    const timeout = setTimeout(() => {
      active = false;
      setError('Your event took too long to load. Close this screen and try again.');
    }, 10000);
    Promise.all([eventNameStore(AsyncStorage, newEvent).read(), eventStore(AsyncStorage).read(), eventStore(AsyncStorage).active()])
      .then(async ([draft, ledger, event]) => {
        if (!active) return;
        clearTimeout(timeout);
        const next = offersFor(offerEntitlementsFor(ledger, event?.id ?? ''), newEvent && ledger.firstEventId !== null);
        setName(draft.name); setLocked(draft.locked); setOffers(next); setSelected(next[0]); setPaidUnused(unusedNewEvents(ledger).length); setLoaded(true);
        if (ledger.purchasedExtras?.some(extra => !ledger.extras.includes(extra))) setMessage(EXTRA_DOWNLOAD_MESSAGE);
        // Event details are ready: Restore does not depend on store prices.
        const catalog = await checkoutCatalog(purchases, next[0] === 'dw_new_event' ? 'new_event' : event?.fullPlan ? 'after_unlock' : 'default');
        if (!active) return;
        setProducts(catalog.products);
        if (catalog.error) setError(catalog.error);
      }).catch(() => { clearTimeout(timeout); if (active) setError('Could not read your event. Close this screen and try again.'); });
    return () => { active = false; clearTimeout(timeout); };
  }, [newEvent]));
  async function transact(restore = false) {
    setSaving(true); setError(''); setMessage('');
    try {
      const saved = await checkoutRead(() => dateStore(AsyncStorage).read());
      const buyingNewEvent = !restore && selected === 'dw_new_event';
      // The date she asked for when her three date changes ran out, else the current one.
      const date = buyingNewEvent ? newEventDate(requestedDate, saved) : saved;
      if (!date) throw Error('Set your wedding date on the plan first.');
      if (buyingNewEvent && await checkoutRead(async () => (await phoneSharing()).read())) throw Error('Stop sharing your current event first (More, then Two phones). Then start the new event.');
      if (restore) await phoneCheckout.restore(name, date);
      else {
        if (!selected) throw Error('Choose a product first.');
        await phoneCheckout.purchase(name, date, selected);
      }
      sharingChanged();
      const downloaded = await checkoutRead(() => downloadStore(AsyncStorage).saved());
      const [event, ledger] = await checkoutRead(() => Promise.all([eventStore(AsyncStorage).active(), eventStore(AsyncStorage).read()]));
      const unused = unusedNewEvents(ledger).length;
      setPaidUnused(unused);
      if (buyingNewEvent) {
        // The new event is now the open one: its reminders follow its date.
        await syncReminders().catch(() => {});
        setMessage(`Your new event is ready: ${event?.name ?? name}. Open your plan to see it.`);
        setOffers([]); setSelected(undefined); setProducts([]); setName(event?.name ?? name); setLocked(true);
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
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not check your purchase. Restore and try again.'); }
    finally { setSaving(false); }
  }
  // An event already paid for and not started needs no store price: it is not charged again.
  const prepaid = selected === 'dw_new_event' && paidUnused > 0;
  const canBuy = purchases.available && loaded && !saving && !!selected && offers.includes(selected) && !!name.trim() && (prepaid || products.some(p => p.id === selected));
  async function saveName() {
    setSaving(true); setError(''); setMessage('');
    try { setName(await eventNameStore(AsyncStorage, newEvent).save(name)); setMessage('Event name saved on this phone.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save your event name. Please try again.'); }
    finally { setSaving(false); }
  }
  return <PlannedScreen route="/more/full-plan">
    <Text accessibilityRole="header" style={type.title}>{newEvent ? 'A new wedding event' : 'The full plan'}</Text>
    <Text style={type.body}>Your free plan stays free. The full plan is paid once for this wedding, with no subscription, and adds:</Text>
    <View style={{ gap: space[2] }}>
      {['Payments and the final-payment schedule', 'Your wedding-week sheet, with who to call', 'The printable hand-over packet with payments and contacts', 'Every tradition pack', 'Reminders for your dated tasks', 'A second phone for your partner'].map(line => <Text key={line} style={type.body}>• {line}</Text>)}
    </View>
    {!purchases.available ? <Text accessibilityRole="status" style={type.sub}>{PREVIEW ? PREVIEW_NOTE : STORE_AWAY}</Text> : null}
    {newEvent ? <Text style={type.body}>A new event is a new full plan, paid once, with its own name and date. Everything you have ticked and added stays on this phone.</Text> : null}
    {newEvent && paidUnused > 0 ? <Text accessibilityRole="status" style={type.body}>You have already paid for this event. Starting it costs nothing more.</Text> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: color.redPen }}>{error}</Text> : null}
    {loaded ? locked ? <Text style={type.body}>🔒 {name}</Text> : <View style={{ gap: space[2] }}>
      <Text style={type.subhead}>Name this wedding</Text>
      <TextInput accessibilityLabel="Name this wedding" placeholder="For example: Sam and Alex, June 2027" placeholderTextColor={color.midnightMuted} value={name} onChangeText={value => { setName(value); setMessage(''); }} maxLength={140} editable={!saving} style={[type.body, { borderWidth: 1, borderColor: color.rule, borderRadius: radius.md, padding: space[3] }]} />
      <Text style={type.sub}>The name goes on your full plan. You can change it until you buy; after that it stays with this wedding. Naming it changes nothing in your free plan.</Text>
      {name.trim() ? <Pressable accessibilityRole="button" disabled={saving} onPress={() => { void saveName(); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[type.button, { color: color.blue }]}>Save this name ›</Text></Pressable> : null}
    </View> : null}
    {message ? <Text accessibilityRole="status" style={type.sub}>{message}</Text> : null}
    {offers.map(id => <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: selected === id }} onPress={() => setSelected(id)}
      style={{ minHeight: 64, padding: space[3], borderRadius: radius.md, borderWidth: selected === id ? 2 : 1, borderColor: selected === id ? color.blue : color.rule, gap: space[1] }}>
      <Text style={type.button}>{names[id]}</Text>
      <Text style={type.sub}>{id === 'dw_planner_printables' ? 'Includes printables' : id === 'dw_new_event' ? 'One new event, paid once' : 'For this wedding'}</Text>
      <Text style={type.sub}>{id === 'dw_new_event' && paidUnused > 0 ? 'Already paid' : products.find(p => p.id === id)?.price ?? (PREVIEW ? `$${PRODUCTS[id].priceUsd.toFixed(2)}, paid once` : 'Loading the price…')}</Text>
    </Pressable>)}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canBuy }} disabled={!canBuy} onPress={() => { void transact(); }}
      style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: color.blue, borderRadius: radius.md, opacity: canBuy ? 1 : 0.5 }}>
      <Text style={[type.button, { color: color.onBlue }]}>{canBuy ? selected === 'dw_new_event' ? 'Start my new event ›' : locked ? 'Add to my plan ›' : 'Get the full plan ›' : !purchases.available ? (PREVIEW ? 'Buying is off in this preview' : 'The store is not answering') : !name.trim() ? 'Name this wedding first' : 'Choose one above'}</Text>
    </Pressable>
    {purchases.available ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving || !loaded }} disabled={saving || !loaded} onPress={() => { void transact(true); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[type.button, { color: color.blue }]}>I already bought this: restore it ›</Text></Pressable> : null}
    <View style={{ flexDirection: 'row', gap: space[4] }}>
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL('https://weddingchecklistpdf.com/terms')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={type.sub}>Terms</Text></Pressable>
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL('https://weddingchecklistpdf.com/privacy')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={type.sub}>Privacy</Text></Pressable>
    </View>
  </PlannedScreen>;
}
