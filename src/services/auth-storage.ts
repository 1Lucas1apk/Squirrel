import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY_EMAIL = 'squirrel_auth_email';
const KEY_PASS = 'squirrel_auth_pass';
const KEY_UID = 'squirrel_auth_uid';

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

export async function updateStoredPassword(newPass: string) {
  const creds = await getCredentials();
  if (creds && creds.email) {
    await saveCredentials(creds.email, newPass);
  }
}

export async function updateStoredEmail(newEmail: string) {
  const creds = await getCredentials();
  if (creds && creds.pass) {
    await saveCredentials(newEmail, creds.pass);
  }
}

export async function saveUid(uid: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(KEY_UID, uid);
    return;
  }
  await SecureStore.setItemAsync(KEY_UID, uid);
}

export async function getUid(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(KEY_UID);
  }
  return SecureStore.getItemAsync(KEY_UID);
}

export async function clearCredentials() {
  if (Platform.OS === 'web') {
    localStorage.removeItem(KEY_EMAIL);
    localStorage.removeItem(KEY_PASS);
    localStorage.removeItem(KEY_UID);
    return;
  }
  await SecureStore.deleteItemAsync(KEY_EMAIL);
  await SecureStore.deleteItemAsync(KEY_PASS);
  await SecureStore.deleteItemAsync(KEY_UID);
}

const KEY_BO_USER = 'squirrel_bo_user';
const KEY_BO_PASS = 'squirrel_bo_pass';

export async function saveBackofficeCredentials(user: string, pass: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY_BO_USER, user);
      localStorage.setItem(KEY_BO_PASS, pass);
    }
    return;
  }
  await SecureStore.setItemAsync(KEY_BO_USER, user);
  await SecureStore.setItemAsync(KEY_BO_PASS, pass);
}

export async function getBackofficeCredentials(): Promise<{ user: string; pass: string }> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      return {
        user: localStorage.getItem(KEY_BO_USER) || '',
        pass: localStorage.getItem(KEY_BO_PASS) || '',
      };
    }
    return { user: '', pass: '' };
  }
  const user = await SecureStore.getItemAsync(KEY_BO_USER);
  const pass = await SecureStore.getItemAsync(KEY_BO_PASS);
  return { user: user || '', pass: pass || '' };
}
