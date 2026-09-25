import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { createIdentityStore } from './identityStore';

export const identityStore = createIdentityStore(Platform.OS === 'web' ? {
  async getItem(key) { return window.sessionStorage.getItem(key); },
  async setItem(key, value) { window.sessionStorage.setItem(key, value); },
} : AsyncStorage, randomUUID);

export function backendUrl() {
  const configured = process.env.EXPO_PUBLIC_WS_URL;
  if (configured) return configured;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.protocol === 'https:' ? `wss://${window.location.host}/ws` : `ws://${window.location.hostname}:8080/ws`;
  }
  return Platform.OS === 'android' ? 'ws://10.0.2.2:8080/ws' : 'ws://localhost:8080/ws';
}
