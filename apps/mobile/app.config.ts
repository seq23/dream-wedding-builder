import type { ExpoConfig } from 'expo/config';
import release from './release/config.json';
// Dream Wedding phone app (plan: docs/APP_PLAN.md at the repo root).
// BUNDLE_ID is a placeholder until the store accounts exist (her call: the company
// accounts after the D-U-N-S number). The release task refuses a store build while it
// still ends in ".placeholder" (NAMED STOP [BUNDLE_ID_PLACEHOLDER], Codex task 11).
const BUNDLE_ID = release.bundleId;
const config: ExpoConfig = {
  name: 'Dream Wedding', slug: 'dream-wedding-builder', version: '0.1.0', scheme: 'dreamwedding',
  // The brand is light only (spry brain, Dream Wedding brand, 6 Nov 2026).
  orientation: 'portrait', userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  ios: { bundleIdentifier: BUNDLE_ID, supportsTablet: false, infoPlist: { ITSAppUsesNonExemptEncryption: false } },
  android: { package: BUNDLE_ID, allowBackup: false,
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#FAF7F2' },
    blockedPermissions: ['android.permission.RECORD_AUDIO', 'android.permission.ACCESS_FINE_LOCATION', 'android.permission.READ_CONTACTS'] },
  updates: { enabled: false },
  experiments: { tsconfigPaths: true },
  plugins: ['expo-router', 'expo-font', 'expo-notifications',
    ['expo-splash-screen', { image: './assets/splash.png', imageWidth: 120, backgroundColor: '#FAF7F2' }],
    // Photos she loves, for the free journey: read for colours on the phone; never the camera.
    ['expo-image-picker', { photosPermission: 'Dream Wedding reads the colours of photos you choose, on this phone.', cameraPermission: false, microphonePermission: false }]],
};
export default config;
