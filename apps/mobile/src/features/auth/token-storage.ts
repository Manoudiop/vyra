import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const REFRESH_TOKEN_KEY = 'vyra.refreshToken';

/**
 * Persists only the refresh token. Native: Keychain / Android Keystore via
 * SecureStore (never AsyncStorage). The access token lives in memory only.
 *
 * Web is a development target (Expo web); SecureStore is unavailable there, so
 * it falls back to localStorage. Do not ship the web build as a product as-is.
 */
export const tokenStorage = {
  async getRefreshToken(): Promise<string | null> {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(REFRESH_TOKEN_KEY) ?? null;
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },

  async setRefreshToken(token: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(REFRESH_TOKEN_KEY, token);
      return;
    }
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  },

  async clear(): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(REFRESH_TOKEN_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
};
