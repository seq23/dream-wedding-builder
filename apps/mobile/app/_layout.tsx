import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { InstrumentSans_400Regular, InstrumentSans_600SemiBold } from '@expo-google-fonts/instrument-sans';
import { DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { color } from '../src/theme';

// Fonts are OFL (Google Fonts) and bundled in the app; nothing loads from the network.
export default function Layout() {
  const [loaded] = useFonts({ InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic, InstrumentSans_400Regular, InstrumentSans_600SemiBold, DMMono_500Medium });
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.ivory } }}>
        <Stack.Screen name="add-task" options={{ presentation: 'formSheet' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
