import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router, type Href } from 'expo-router';
import { color, radius, space, type } from './theme';
import { byRoute } from './screens';
import { BackButton, goHome, useBackKeys } from './nav';
import { HOME } from './screens';

// The shell every scaffold screen uses: what Codex builds here, and the screen's buttons
// from the map. Inside a tab the header (src/nav.tsx) carries the title and Back or Close,
// and the tab bar stays below. Onboarding has no header, so its Back and Skip are drawn here.
export function PlannedScreen({ route, children, implemented = false }: { route: string; children?: React.ReactNode; implemented?: boolean }) {
  const s = byRoute(route);
  useBackKeys(route);
  const onboarding = s.kind === 'onboarding';
  const skip = implemented ? undefined : s.links.find(l => l.label === 'Skip ›');
  const body = (
    <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
      {onboarding ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
          {s.back ? <BackButton route={route} />
            : router.canGoBack() ? <TextButton label="← Back" onPress={() => router.back()} />
            : <Text style={[type.label, { color: color.midnightMuted }]}>Dream Wedding</Text>}
          {skip ? <TextButton label={skip.label} onPress={goHome} /> : null}
        </View>
      ) : null}
      {onboarding && !implemented ? <Text accessibilityRole="header" style={[type.title, { color: color.midnight }]}>{s.title}</Text> : null}
      {!implemented ? <View style={{ backgroundColor: color.ivoryRaised, borderColor: color.rule, borderWidth: 1, borderRadius: radius.md, padding: space[4] }}>
        <Text style={[type.label, { color: color.midnightMuted, marginBottom: space[2] }]}>Coming next</Text>
        <Text style={[type.body, { color: color.midnight }]}>{s.coming}</Text>
      </View> : null}
      {children}
      {!implemented && s.links.filter(l => l !== skip).map((l, i) => onboarding && l.href === HOME
        ? <ActionButton key={l.label} label={l.label} primary={i === 0} onPress={goHome} />
        : <GoButton key={l.href + l.label} href={l.href} label={l.label} primary={i === 0} />)}
    </ScrollView>
  );
  return onboarding
    ? <SafeAreaView style={{ flex: 1, backgroundColor: color.ivory }}>{body}</SafeAreaView>
    : s.kind === 'sheet'
      ? <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: color.ivory }}>
          <View style={{ height: '90%', backgroundColor: color.ivoryRaised, borderTopWidth: 1, borderColor: color.rule, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md }}>{body}</View>
        </View>
      : <View style={{ flex: 1, backgroundColor: color.ivory }}>{body}</View>;
}

function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center' }}>
      <Text style={[type.button, { color: color.blue }]}>{label}</Text>
    </Pressable>
  );
}

const buttonStyle = (primary: boolean) => ({ minHeight: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: primary ? color.blue : color.midnight,
  backgroundColor: primary ? color.blue : color.ivoryRaised, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: space[5] });

function ActionButton({ label, primary = false, onPress }: { label: string; primary?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={buttonStyle(primary)}>
      <Text style={[type.button, { color: primary ? color.onBlue : color.midnight }]}>{label}</Text>
    </Pressable>
  );
}

export function GoButton({ href, label, primary = false }: { href: string; label: string; primary?: boolean }) {
  return (
    <Link href={href as Href} asChild>
      <Pressable accessibilityRole="button" style={buttonStyle(primary)}>
        <Text style={[type.button, { color: primary ? color.onBlue : color.midnight }]}>{label}</Text>
      </Pressable>
    </Link>
  );
}
