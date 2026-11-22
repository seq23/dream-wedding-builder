import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { ratingAsk } from './ratingAsk';
const preview = process.env.EXPO_PUBLIC_DW_PREVIEW === '1';
// The web preview never asks: it has no store, and its saved data is fictional.
export const rating = ratingAsk(AsyncStorage, preview ? { isAvailableAsync: async () => false, requestReview: async () => {} } : StoreReview);
