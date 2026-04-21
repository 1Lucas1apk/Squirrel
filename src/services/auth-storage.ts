import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY_EMAIL = '@squirrel_auth_email';
const KEY_PASS = '@squirrel_auth_pass';

export async function saveCredentials(email: string, pass: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(KEY_EMAIL, email);
    localStorage.setItem(KEY_PASS, pass);
    return;
  }
  await SecureStore.setItemAsync(KEY_EMAIL, email);
  await SecureStore.setItemAsync(KEY_PASS, pass);
}

export async function getCredentials() {
  if (Platform.OS === 'web') {
    return {
      email: localStorage.getItem(KEY_EMAIL),
      pass: localStorage.getItem(KEY_PASS)
    };
  }
  const email = await SecureStore.getItemAsync(KEY_EMAIL);
  const pass = await SecureStore.getItemAsync(KEY_PASS);
  return { email, pass };
}

export async function clearCredentials() {
  if (Platform.OS === 'web') {
    localStorage.removeItem(KEY_EMAIL);
    localStorage.removeItem(KEY_PASS);
    return;
  }
  await SecureStore.deleteItemAsync(KEY_EMAIL);
  await SecureStore.deleteItemAsync(KEY_PASS);
}
