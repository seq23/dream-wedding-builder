import { Stack } from 'expo-router';
import { color, font } from './theme';
import { SCREENS, type Tab } from './screens';
import { headerFor } from './nav';

// One stack per tab, so a sub-screen keeps the tab bar under it and Back (and Android
// back) stays inside the tab. Tapping the tab you are on pops back to its root (the
// stack's own tabPress behaviour). Sheets open over the tab with "✕ Close".
export function TabStack({ tab }: { tab: Tab }) {
  const screens = SCREENS.filter(s => s.tab === tab);
  return (
    <Stack screenOptions={{ headerShadowVisible: false, headerStyle: { backgroundColor: color.ivory }, headerTintColor: color.midnight,
      headerTitleStyle: { fontFamily: font.sansBold, fontSize: 17 }, contentStyle: { backgroundColor: color.ivory } }}>
      {screens.map(s => {
        const name = s.file.split('/').pop()!.replace(/\.tsx$/, '');
        return <Stack.Screen key={s.route} name={name} options={{ ...headerFor(s.route), presentation: s.kind === 'sheet' ? 'modal' : 'card' }} />;
      })}
    </Stack>
  );
}
