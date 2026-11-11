import AsyncStorage from '@react-native-async-storage/async-storage';
import { progressStore } from './planTasks';
import { syncReminders } from './localReminders';
const store = progressStore(AsyncStorage);
export const savedProgress = { read: store.read, async update(...args: Parameters<typeof store.update>) { const result = await store.update(...args); await syncReminders(); return result; } };
