import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createPreferenceStore } from './preferenceStore';
export const preferenceStore = createPreferenceStore(Platform.OS === 'web' ? {
  async getItem(key) { return window.localStorage.getItem(key); },
  async setItem(key, value) { window.localStorage.setItem(key, value); },
} : AsyncStorage);
