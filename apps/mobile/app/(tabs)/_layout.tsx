import { Tabs } from 'expo-router';
import { color, font } from '../../src/theme';
import { TABS } from '../../src/screens';

// The shipped tabs: Plan (home) · Traditions · Payments · ☰ More
// (make-it-calm section 7). Android back from another tab's root returns to Plan.
export default function TabsLayout() {
  return (
    <Tabs backBehavior="firstRoute" screenOptions={{ headerShown: false, tabBarActiveTintColor: color.blue, tabBarInactiveTintColor: color.midnightMuted,
      tabBarStyle: { backgroundColor: color.ivoryRaised, borderTopColor: color.rule }, tabBarIconStyle: { display: 'none' },
      tabBarLabelStyle: { fontFamily: font.sansBold, fontSize: 14 }, tabBarItemStyle: { justifyContent: 'center' } }}>
      {TABS.map(t => <Tabs.Screen key={t.tab} name={t.tab} options={{ title: t.label }} />)}
    </Tabs>
  );
}
