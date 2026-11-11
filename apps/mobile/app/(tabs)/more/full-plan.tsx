import { useCallback, useState } from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { getRandomBytes } from 'expo-crypto';
import { bytesToHex } from '@noble/ciphers/utils.js';
import { checkout, checkoutRead } from '../../../src/billing/checkout';
import { downloadStore } from '../../../src/billing/downloadStore';
import { dateStore } from '../../../src/weddingDate';
import { sharingChanged } from '../../../src/sharing/runtime';
import { PlannedScreen } from '../../../src/ui';
import { offersFor, type ProductId } from '../../../src/billing/offers';
import type { StoreProduct } from '../../../src/billing/provider';
import { purchases } from '../../../src/billing/current';
import { eventNameStore } from '../../../src/billing/eventName';
import { eventStore } from '../../../src/billing/eventStore';
import { entitlementsFor } from '../../../src/billing/events';
import { color, type, space, radius } from '../../../src/theme';
const phoneCheckout = checkout(AsyncStorage, purchases, downloadStore(AsyncStorage), () => bytesToHex(getRandomBytes(16)));
const names: Record<ProductId, string> = { dw_planner_printables: 'Planner + printables', dw_full_plan: 'Full plan', dw_printables_topup: 'Printables', dw_day_of_kit: 'Day-of kit', dw_new_event: 'Full plan for a new event' };
export default function FullPlan() {
  const { newEvent: requestedNewEvent } = useLocalSearchParams<{ newEvent?: string }>();
  const newEvent = requestedNewEvent === '1';
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [offers, setOffers] = useState<ProductId[]>([]);
  const [selected, setSelected] = useState<ProductId>();
  const [name, setName] = useState('');
  const [locked, setLocked] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoaded(false); setError(''); setMessage('');
    const timeout = setTimeout(() => {
      active = false;
      setError('Your event took too long to load. Close this screen and try again.');
    }, 10000);
    Promise.all([eventNameStore(AsyncStorage, newEvent).read(), eventStore(AsyncStorage).read(), eventStore(AsyncStorage).active()])
      .then(async ([draft, ledger, event]) => {
        if (!active) return;
        const catalog = purchases.available ? await purchases.products(event?.fullPlan ? 'after_unlock' : 'default') : [];
        if (!active) return;
        clearTimeout(timeout); setProducts(catalog);
        const next = offersFor(entitlementsFor(ledger, event?.id ?? ''), newEvent && ledger.firstEventId !== null);
        setName(draft.name); setLocked(draft.locked); setOffers(next); setSelected(next[0]); setLoaded(true);
      }).catch(() => { clearTimeout(timeout); if (active) setError('Could not read your event. Close this screen and try again.'); });
    return () => { active = false; clearTimeout(timeout); };
  }, [newEvent]));
  async function transact(restore = false) {
    setSaving(true); setError(''); setMessage('');
    try {
      const date = await checkoutRead(() => dateStore(AsyncStorage).read());
      if (!date) throw Error('Set your wedding date on the plan first.');
      if (restore) await phoneCheckout.restore(name, date);
      else {
        if (!selected) throw Error('Choose a product first.');
        await phoneCheckout.purchase(name, date, selected);
      }
      sharingChanged();
      setLocked(true); setMessage('Your full plan is saved on this phone.');
      const [event, ledger] = await checkoutRead(() => Promise.all([eventStore(AsyncStorage).active(), eventStore(AsyncStorage).read()]));
      if (event) setName(event.name);
      setOffers(offersFor(entitlementsFor(ledger, event?.id ?? '')));
      setSelected(undefined);
      setProducts([]);
      try { setProducts(await checkoutRead(() => purchases.products('after_unlock'))); }
      catch { setMessage('Your full plan is saved. Reopen this screen to load store prices for extras.'); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not check your purchase. Restore and try again.'); }
    finally { setSaving(false); }
  }
  const canBuy = purchases.available && loaded && !saving && !newEvent && !!selected && offers.includes(selected) && !!name.trim() && products.some(p => p.id === selected);
  async function saveName() {
    setSaving(true); setError(''); setMessage('');
    try { setName(await eventNameStore(AsyncStorage, newEvent).save(name)); setMessage('Event name saved on this phone.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save your event name. Please try again.'); }
    finally { setSaving(false); }
  }
  return <PlannedScreen route="/more/full-plan" implemented>
    <Text accessibilityRole="header" style={type.title}>{newEvent ? 'A new wedding event' : 'Your full wedding plan'}</Text>
    <Text style={type.body}>Paid once for this wedding. No subscription.</Text>
    {!purchases.available ? <Text accessibilityRole="status" style={type.body}>Purchases are not set up yet.</Text> : null}
    {newEvent ? <Text style={type.body}>A new event needs its own full-plan purchase. Your current event stays as it is. The store price will appear here before you can buy.</Text> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: color.redPen }}>{error}</Text> : null}
    {loaded ? locked ? <Text style={type.body}>🔒 {name}</Text> : <View style={{ gap: space[2] }}>
      <Text style={type.sub}>Event name</Text>
      <TextInput accessibilityLabel="Event name" value={name} onChangeText={value => { setName(value); setMessage(''); }} maxLength={140} editable={!saving} style={[type.body, { borderWidth: 1, borderColor: color.rule, borderRadius: radius.md, padding: space[3] }]} />
      <Text style={type.sub}>This name locks after purchase. Saving a name keeps your current plan as it is.</Text>
      <Pressable accessibilityRole="button" disabled={saving || !name.trim()} onPress={() => { void saveName(); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[type.button, { color: color.blue }]}>Save event name</Text></Pressable>
    </View> : null}
    {message ? <Text accessibilityRole="status" style={type.sub}>{message}</Text> : null}
    <View style={{ gap: space[2] }}>
      <Text style={type.sub}>Payments and final-payment schedule</Text>
      <Text style={type.sub}>Wedding-week sheet</Text>
      <Text style={type.sub}>Printable hand-over packet</Text>
      <Text style={type.sub}>Tradition packs</Text>
      <Text style={type.sub}>Reminders for your dated tasks</Text>
    </View>
    {offers.map(id => <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: selected === id }} onPress={() => setSelected(id)}
      style={{ minHeight: 64, padding: space[3], borderRadius: radius.md, borderWidth: selected === id ? 2 : 1, borderColor: selected === id ? color.blue : color.rule, gap: space[1] }}>
      <Text style={type.button}>{names[id]}</Text>
      <Text style={type.sub}>{id === 'dw_planner_printables' ? 'Includes printables' : id === 'dw_new_event' ? 'Your existing event stays as it is' : 'For this wedding'}</Text>
      <Text style={type.sub}>{products.find(p => p.id === id)?.price ?? 'Price available when the store is ready'}</Text>
    </Pressable>)}
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canBuy }} disabled={!canBuy} onPress={() => { void transact(); }}
      style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: color.blue, borderRadius: radius.md, opacity: canBuy ? 1 : 0.5 }}>
      <Text style={[type.button, { color: color.onBlue }]}>{canBuy ? locked ? 'Add to my plan' : 'Unlock full plan' : 'Purchases unavailable'}</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !purchases.available || saving || !loaded }} disabled={!purchases.available || saving || !loaded} onPress={() => { void transact(true); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={type.sub}>{purchases.available ? 'Restore purchase' : 'Restore purchase · unavailable'}</Text></Pressable>
    <View style={{ flexDirection: 'row', gap: space[4] }}>
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL('https://weddingchecklistpdf.com/terms')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={type.sub}>Terms</Text></Pressable>
      <Pressable accessibilityRole="link" onPress={() => Linking.openURL('https://weddingchecklistpdf.com/privacy')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={type.sub}>Privacy</Text></Pressable>
    </View>
  </PlannedScreen>;
}
