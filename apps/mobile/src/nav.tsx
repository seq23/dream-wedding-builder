import React, { useEffect } from 'react';
import { BackHandler, Platform, Pressable, Text } from 'react-native';
import { router, type Href } from 'expo-router';
import { color, type } from './theme';
import { HOME, byRoute } from './screens';

// One way back from every screen. "← Back" goes to the screen's parent in the map
// (src/screens.ts); if this screen was opened straight from a link with nothing under it,
// it still lands on the parent, never out of the app.
export function goBack(route: string) {
  const s = byRoute(route);
  if (router.canGoBack()) router.back();
  else router.replace((s.back ?? HOME) as Href);
}

export function BackButton({ route }: { route: string }) {
  const s = byRoute(route);
  if (!s.back) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => goBack(route)} hitSlop={8}
      style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', paddingRight: 12 }}>
      <Text style={[type.button, { color: color.blue }]}>← Back</Text>
    </Pressable>
  );
}

export function CloseButton({ route }: { route: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => goBack(route)} hitSlop={8}
      style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', paddingLeft: 12 }}>
      <Text style={[type.button, { color: color.midnight }]}>✕ Close</Text>
    </Pressable>
  );
}

// Leaving onboarding: clear the steps under it so Android back on the plan never walks
// back into them, then land on the plan.
export function goHome() {
  if (router.canDismiss()) router.dismissAll();
  router.replace(HOME as Href);
}

// Header options for a screen inside a stack: its title names where you are; sub-screens
// get "← Back", sheets get "✕ Close", tab roots get neither (the tab bar is there).
export function headerFor(route: string) {
  const s = byRoute(route);
  return {
    title: s.title,
    headerBackVisible: false,
    headerLeft: s.kind === 'sheet' ? undefined : () => <BackButton route={route} />,
    headerRight: s.kind === 'sheet' ? () => <CloseButton route={route} /> : undefined,
  };
}

// Android back and Escape (web, hardware keyboards) on a sub-screen or sheet go to its
// parent, the same as "← Back"; on a tab root Android back keeps its normal meaning.
export function useBackKeys(route: string) {
  const s = byRoute(route);
  useEffect(() => {
    if (!s.back) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { goBack(route); return true; });
    let off = () => {};
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') goBack(route); };
      document.addEventListener('keydown', onKey);
      off = () => document.removeEventListener('keydown', onKey);
    }
    return () => { sub.remove(); off(); };
  }, [route, s.back]);
}
