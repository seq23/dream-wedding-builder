import AsyncStorage from '@react-native-async-storage/async-storage';
import { dateStore } from './weddingDate';
export const savedDate = dateStore(AsyncStorage);
