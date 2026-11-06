import { Tabs } from 'expo-router';
import { color, font } from '../../src/theme';

// Four tabs at most (make-it-calm): Plan · Traditions · Two phones · More.
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: color.blue, tabBarInactiveTintColor: color.midnightMuted,
      tabBarStyle: { backgroundColor: color.ivoryRaised, borderTopColor: color.rule }, tabBarIconStyle: { display: 'none' },
      tabBarLabelStyle: { fontFamily: font.sansBold, fontSize: 13 } }}>
      <Tabs.Screen name="plan" options={{ title: 'Plan' }} />
      <Tabs.Screen name="traditions" options={{ title: 'Traditions' }} />
      <Tabs.Screen name="two-phones" options={{ title: 'Two phones' }} />
      <Tabs.Screen name="more" options={{ title: '☰ More' }} />
    </Tabs>
  );
}
