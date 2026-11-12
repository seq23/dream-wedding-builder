import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRandomBytes } from 'expo-crypto';
import { bytesToHex } from '@noble/ciphers/utils.js';
import { Platform } from 'react-native';
import { planReach, metricsBuild } from './planReach';

const enabled = metricsBuild({ flag: process.env.EXPO_PUBLIC_DW_METRICS,
  preview: process.env.EXPO_PUBLIC_DW_PREVIEW, development: __DEV__, platform: Platform.OS });
export const phoneMetrics = planReach(AsyncStorage, () => bytesToHex(getRandomBytes(16)), fetch, enabled);
