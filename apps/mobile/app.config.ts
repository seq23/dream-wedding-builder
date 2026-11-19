import type { ExpoConfig } from 'expo/config';
import release from './release/config.json';
// Dream Wedding phone app (plan: docs/APP_PLAN.md at the repo root).
// BUNDLE_ID: registered with Apple 14 Nov 2026 (individual account, her call that day).
// The release gate refuses a store build if it ever ends in ".placeholder"
// (NAMED STOP [BUNDLE_ID_PLACEHOLDER]).
const BUNDLE_ID = release.bundleId;
const config: ExpoConfig = {
  name: 'Dream Wedding', slug: 'dream-wedding-builder', version: '1.0', scheme: 'dreamwedding',
  // EAS project under the seq23 Expo account (eas init, 14 Nov 2026).
  owner: 'seq23', extra: { eas: { projectId: 'ca5bcca0-2408-45a4-ac3d-b498eb0ed613' } },
  // The brand is light only (spry brain, Dream Wedding brand, 6 Nov 2026).
  orientation: 'portrait', userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  ios: { bundleIdentifier: BUNDLE_ID, supportsTablet: false, infoPlist: { ITSAppUsesNonExemptEncryption: false } },
  android: { package: BUNDLE_ID, allowBackup: false,
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#FAF7F2' },
    // Library permissions the app never uses. Photos come through the system photo picker, which needs
    // no permission (and READ_MEDIA_IMAGES would need Play's photo and video declaration); files leave
    // through the share sheet; nothing draws over other apps.
    blockedPermissions: ['android.permission.RECORD_AUDIO', 'android.permission.ACCESS_FINE_LOCATION', 'android.permission.READ_CONTACTS',
      'android.permission.SYSTEM_ALERT_WINDOW', 'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_IMAGES', 'android.permission.READ_MEDIA_VIDEO', 'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
      'android.permission.READ_MEDIA_AUDIO'] },
  updates: { enabled: false },
  experiments: { tsconfigPaths: true },
  plugins: ['expo-router', 'expo-font', 'expo-notifications',
    ['expo-splash-screen', { image: './assets/splash.png', imageWidth: 120, backgroundColor: '#FAF7F2' }],
    // Photos she loves, for the free journey: read for colours on the phone; never the camera.
    ['expo-image-picker', { photosPermission: 'Dream Wedding reads the colours of photos you choose, on this phone.', cameraPermission: false, microphonePermission: false }]],
};
export default config;
