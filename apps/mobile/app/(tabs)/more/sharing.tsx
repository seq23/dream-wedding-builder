import { useCallback, useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlannedScreen, GoButton } from '../../../src/ui';
import { phoneSharing, sharedAccess, sharingChanged } from '../../../src/sharing/runtime';
import { useSharingRevision } from '../../../src/sharing/useSharing';
import { inviteLink, SHARE_UNAVAILABLE } from '../../../src/sharing/crypto';
import type { SharedEvent, ShareSession } from '../../../src/sharing/session';
import { color, type, space } from '../../../src/theme';
export default function Sharing() {
  const { invite } = useLocalSearchParams<{ invite?: string }>();
  const revision = useSharingRevision();
  const [session, setSession] = useState<ShareSession | null>(null);
  const [event, setEvent] = useState<SharedEvent | null>(null);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [confirm, setConfirm] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      const api = await phoneSharing();
      const current = await api.read();
      const inspected = invite && !current ? await api.inspect(invite) : null;
      const failure = await AsyncStorage.getItem('dw.sharing.error.v1');
      if (active) { setSession(current); setEvent(inspected); setReady(true); setError(failure ?? ''); }
    })().catch(e => { if (active) { setReady(true); setError(e instanceof Error ? e.message : SHARE_UNAVAILABLE); } });
    return () => { active = false; };
  }, [invite, revision]));
  async function action(kind: 'invite' | 'join' | 'stop' | 'leave' | 'sync') {
    setBusy(true); setError('');
    try {
      const api = await phoneSharing();
      if (kind === 'invite') {
        const current = await api.read() ?? await api.invite();
        await Share.share({ message: inviteLink(current.link) });
      }
      if (kind === 'join' && invite) { await api.join(invite); router.replace('/plan'); }
      if (kind === 'stop') { await (await sharedAccess()).stop(); setConfirm(false); }
      if (kind === 'leave') { await api.leave(); router.replace('/plan'); }
      if (kind === 'sync') await api.sync();
      setSession(await api.read()); sharingChanged();
    } catch(e) { setError(e instanceof Error ? e.message : SHARE_UNAVAILABLE); }
    finally { setBusy(false); sharingChanged(); }
  }
  const button = (label: string, run: () => void, primary = false) => <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={run} style={{ minHeight: 48, padding: space[3], justifyContent: 'center', backgroundColor: primary ? color.blue : color.ivory }}><Text style={[type.button, { color: primary ? color.onBlue : color.blue }]}>{label}</Text></Pressable>;
  return <PlannedScreen route="/more/sharing" implemented>
    {error ? <Text accessibilityRole="alert" style={type.body}>{error}</Text> : null}
    {!ready ? <Text style={type.body}>Opening sharing…</Text> : session ? <>
      <Text style={type.title}>{session.role === 'owner' ? 'Sharing is on' : 'Shared with you'}</Text>
      <Text style={type.body}>🔒 {session.plan.event.name} · {session.plan.event.date}</Text>
      <Text style={type.sub}>{session.plan.joined ? 'Your partner joined' : 'Link ready to send'} · Last updated {new Date(session.syncedAt).toLocaleTimeString()}</Text>
      <Text style={type.body}>Ticks catch up when both phones are online. Payment amounts stay on each phone.</Text>
      {button('Sync now', () => void action('sync'))}
      {session.role === 'owner' ? <>
        {button('Send the link again', () => void action('invite'))}
        {confirm ? <View><Text style={type.body}>Your partner’s phone goes back to the free plan. Nothing is removed from yours.</Text>{button('Stop sharing', () => void action('stop'))}{button('Keep sharing', () => setConfirm(false))}</View> : button('Stop sharing', () => setConfirm(true))}
      </> : button('Leave this plan', () => void action('leave'))}
      <GoButton href="/plan" label="Back to my plan ›" />
    </> : event ? <>
      <Text style={type.title}>Join this plan</Text><Text style={type.body}>🔒 {event.name}</Text><Text style={type.body}>{event.date}</Text>
      <Text style={type.body}>You will see the same tasks and payments. Ticks show on both phones. No account and nothing more to pay.</Text>
      {button('Join this plan', () => void action('join'), true)}
      {button('Not now', () => router.replace('/plan'))}
    </> : invite ? <GoButton href="/plan" label="Back to my plan ›" /> : <>
      <Text style={type.title}>Invite my partner</Text><Text style={type.body}>Both phones show the same plan. No account and nothing more to pay.</Text>
      <Text style={type.body}>Anyone with the link can open the plan. Send it only to your partner. The link needs a connection once; ticks catch up later.</Text>
      {button('Send the link', () => void action('invite'), true)}
      <GoButton href="/more/full-plan" label="See the full plan ›" />
    </>}
    {busy ? <Text accessibilityRole="status" style={type.sub}>Saving…</Text> : null}
  </PlannedScreen>;
}
