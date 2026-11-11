import AsyncStorage from '@react-native-async-storage/async-storage';
import { phoneSharing, sharedAccess, sharingChanged } from './sharing/runtime';
import { progressStore } from './planTasks';
import { syncReminders } from './localReminders';
const store = progressStore(AsyncStorage);
export const savedProgress = { async drain() { await (await phoneSharing()).drain(); await store.read(); }, read: async () => (await sharedAccess()).progress(store.read), async update(...args: Parameters<typeof store.update>) { const result = await (await sharedAccess()).update(args[0], () => store.update(...args)); sharingChanged(); await syncReminders(); return result; } };
