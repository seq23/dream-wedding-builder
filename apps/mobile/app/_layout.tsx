import { Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { InstrumentSans_400Regular, InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans';
import { DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { color } from '../src/theme';

// Onboarding (welcome, reminders) draws its own Back and Skip; the tabs carry their own
// stacks with headers (app/(tabs)/*/_layout.tsx). Fonts are OFL and bundled.
export default function Layout() {
  const [loaded, fontError] = useFonts({ InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic, InstrumentSans_400Regular, InstrumentSans_600SemiBold, DMMono_500Medium });
  // A font that cannot load must never leave a blank app: draw with the system font instead.
  if (!loaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, ...(Platform.OS === 'web' ? { width: '100%' as const, maxWidth: 430, alignSelf: 'center' as const } : {}) }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.ivory } }} />
    </View>
    </SafeAreaProvider>
  );
}
