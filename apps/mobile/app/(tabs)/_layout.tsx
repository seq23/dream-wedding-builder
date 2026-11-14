import { Tabs } from 'expo-router';
import { color, font } from '../../src/theme';
import { TABS } from '../../src/screens';

// The shipped tabs: Plan (home) · Traditions · Payments · ☰ More
// (make-it-calm section 7). Android back from another tab's root returns to Plan.
export default function TabsLayout() {
  return (
    <Tabs backBehavior="firstRoute" screenOptions={{ headerShown: false, tabBarActiveTintColor: color.blue, tabBarInactiveTintColor: color.midnightMuted,
      tabBarStyle: { backgroundColor: color.ivoryRaised, borderTopColor: color.rule }, tabBarIconStyle: { display: 'none' },
      // The tabs have no icons. The "below-icon" layout pins a lone label to the top of the
      // 49pt bar and leaves a white band under it (simulator retest, 14 Nov 2026); the
      // "beside-icon" layout centres the label in the bar, above the home-indicator inset.
      tabBarLabelPosition: 'beside-icon',
      tabBarLabelStyle: { fontFamily: font.sansBold, fontSize: 14, marginStart: 0 } }}>
      {TABS.map(t => <Tabs.Screen key={t.tab} name={t.tab} options={{ title: t.label }} />)}
    </Tabs>
  );
}
