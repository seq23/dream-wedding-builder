import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router, type Href } from 'expo-router';
import { color, radius, space, type } from './theme';
import { byRoute } from './screens';
import { BackButton, useBackKeys } from './nav';
import { Logo } from './Logo';

// The shell every screen uses. Inside a tab the header (src/nav.tsx) carries the title and Back or Close,
// and the tab bar stays below. Onboarding has no header, so its Back and Skip are drawn here.
export function PlannedScreen({ route, children }: { route: string; children?: React.ReactNode }) {
  const s = byRoute(route);
  useBackKeys(route);
  const onboarding = s.kind === 'onboarding';
  const body = (
    <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
      {onboarding ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
          {/* The journey's first screen always carries the brand; its steps have their own Back links. */}
          {s.back ? <BackButton route={route} />
            : route !== '/feel' && router.canGoBack() ? <TextButton label="← Back" onPress={() => router.back()} />
            : <Logo />}
        </View>
      ) : null}
      {children}
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

export function GoButton({ href, label, primary = false }: { href: string; label: string; primary?: boolean }) {
  return (
    <Link href={href as Href} asChild>
      <Pressable accessibilityRole="button" style={buttonStyle(primary)}>
        <Text style={[type.button, { color: primary ? color.onBlue : color.midnight }]}>{label}</Text>
      </Pressable>
    </Link>
  );
}
