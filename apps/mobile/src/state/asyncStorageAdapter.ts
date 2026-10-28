import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SessionStorage } from './persistence';

/** On-device storage via Expo-compatible AsyncStorage. */
export const asyncStorageAdapter: SessionStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};
