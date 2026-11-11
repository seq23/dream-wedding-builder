import AsyncStorage from '@react-native-async-storage/async-storage';
import { dateStore } from './weddingDate';
import { syncReminders } from './localReminders';
const store = dateStore(AsyncStorage);
export const savedDate = { read: store.read, async save(...args: Parameters<typeof store.save>) { await store.save(...args); await syncReminders(); } };
