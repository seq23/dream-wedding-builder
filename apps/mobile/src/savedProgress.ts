import AsyncStorage from '@react-native-async-storage/async-storage';
import { progressStore } from './planTasks';
export const savedProgress = progressStore(AsyncStorage);
