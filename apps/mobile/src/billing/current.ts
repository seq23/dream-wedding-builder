import { Platform } from 'react-native';
import { choosePurchases } from './provider';
import { RevenueCat } from './revenuecat';
import { PREVIEW } from '../build';
// The store opens only in a store build with this platform's public RevenueCat key
// (EAS production environment). Client purchase metadata is not proof: nothing
// unlocks until /api/app-unlock verifies the purchase server-side.
export const purchases = choosePurchases(Platform.OS, {
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
}, PREVIEW, key => new RevenueCat(key));
