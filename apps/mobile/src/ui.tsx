import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, type Href } from 'expo-router';
import { color, radius, space, type } from './theme';
import { byRoute } from './screens';

// The empty shell every scaffold screen uses: its title, and what Codex builds there.
export function PlannedScreen({ route, children }: { route: string; children?: React.ReactNode }) {
  const s = byRoute(route);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.ivory }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4] }}>
        <Text style={[type.label, { color: color.midnightMuted }]}>Dream Wedding · preview</Text>
        <Text accessibilityRole="header" style={[type.title, { color: color.midnight }]}>{s.title}</Text>
        <View style={{ backgroundColor: color.ivoryRaised, borderColor: color.rule, borderWidth: 1, borderRadius: radius.md, padding: space[4] }}>
          <Text style={[type.label, { color: color.midnightMuted, marginBottom: space[2] }]}>Planned</Text>
          <Text style={[type.body, { color: color.midnight }]}>{s.planned}</Text>
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function GoButton({ href, label, primary = false }: { href: Href; label: string; primary?: boolean }) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="button" style={{ minHeight: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: primary ? color.blue : color.midnight,
        backgroundColor: primary ? color.blue : color.ivoryRaised, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[5] }}>
        <Text style={[type.button, { color: primary ? color.onBlue : color.midnight }]}>{label}</Text>
      </Pressable>
    </Link>
  );
}
