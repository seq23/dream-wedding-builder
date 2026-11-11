import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRandomBytes } from 'expo-crypto';
import { bytesToHex } from '@noble/ciphers/utils.js';
import { taskKey } from '@core/plan-progress';
import { eventStore } from '../billing/eventStore';
import { downloadStore } from '../billing/downloadStore';
import { purchases } from '../billing/current';
import { progressStore } from '../planTasks';
import { sharingDeadline } from './deadline';
import { shareClient } from './client';
import { sharedPlan, sharingSession, type SharedPlan } from './session';
import { OWNER_PLAN_KEY, activeSharing } from './active';
const events = eventStore(AsyncStorage);
const listeners = new Set<() => void>();
export const watchSharing = (callback: () => void) => { listeners.add(callback); return () => { listeners.delete(callback); }; };
export const sharingChanged = () => { for (const callback of listeners) callback(); };
let initialization: Promise<ReturnType<typeof sharingSession>> | undefined;
export function phoneSharing() {
  return initialization ??= (async () => {
    let actor = await AsyncStorage.getItem('dw.sharing.actor.v1');
    if (!actor) { actor = bytesToHex(getRandomBytes(16)); await AsyncStorage.setItem('dw.sharing.actor.v1', actor); }
    return sharingSession(AsyncStorage, shareClient(getRandomBytes), actor, async (): Promise<SharedPlan | null> => {
      const event = await events.active();
      if (!event?.fullPlan || !purchases.available) return null;
      // SDK metadata never grants access. Fetch all content through the verified
      // server door before constructing an invite; failure leaves the phone alone.
      const snapshot = await sharingDeadline(() => purchases.restore());
      const content = await downloadStore(AsyncStorage).refresh(snapshot.userId);
      const progress = await progressStore(AsyncStorage).read();
      const keys = new Set([...content.list.tasks.map(t => taskKey(t.window, t.text)), ...progress.custom.map(t => `own::${t.id}`)]);
      const ticks = Object.fromEntries(Object.entries(progress.done).filter(([key]) => keys.has(key)).map(([key, at]) => [key, { at: new Date(at).getTime(), actor: actor!, done: true }]));
      const custom = Object.fromEntries(progress.custom.map(t => [t.id, { value: t, at: Date.now(), actor: actor! }]));
      const rawOwner = await AsyncStorage.getItem(OWNER_PLAN_KEY);
      const previous = rawOwner ? sharedPlan(JSON.parse(rawOwner)) : null;
      return { event: { id: event.id, name: event.name, date: event.date }, ...content,
        ticks: previous?.event.id === event.id ? previous.ticks : ticks,
        custom: previous?.event.id === event.id ? previous.custom : custom,
        history: await events.read(), joined: false };
    });
  })();
}
let access: ReturnType<typeof activeSharing> | undefined;
export async function activePlan() { return (await sharedAccess()).plan(); }
export async function sharedAccess() { return access ??= activeSharing(AsyncStorage, await phoneSharing(), events.active); }
let syncing: Promise<void> | undefined;
let paused = false;
export async function pauseSharing() {
  paused = true;
  try { await syncing; } catch { /* clearing local data still works while offline */ }
  return () => { paused = false; sharingChanged(); };
}
export function syncSharing() {
  if (paused) return Promise.resolve();
  return syncing ??= (async () => {
    const session = await phoneSharing();
    if (await session.read()) {
      try { await session.sync(); await AsyncStorage.removeItem('dw.sharing.error.v1'); }
      catch (e) { await AsyncStorage.setItem('dw.sharing.error.v1', e instanceof Error ? e.message : 'Could not sync. Your changes are saved on this phone.'); }
      sharingChanged();
      const { syncReminders } = await import('../localReminders');
      await syncReminders();
    }
  })().finally(() => { syncing = undefined; });
}
