export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ?? "",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "",
};

export function hasFirebaseConfig(): boolean {
  return Object.values(firebaseConfig).every((value) => Boolean(value && value.trim().length > 0));
}

export const googleDriveConfig = {
  clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "",
  clientSecret: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET ?? "",
  refreshToken: process.env.EXPO_PUBLIC_GOOGLE_REFRESH_TOKEN ?? "",
  rootFolderId: process.env.EXPO_PUBLIC_GOOGLE_DRIVE_ROOT_FOLDER_ID ?? "1UZkP2w9Gqu7YuNgNcUF4w17lZUwr_jRf",
};

export function hasGoogleDriveConfig(): boolean {
  return Boolean(
    googleDriveConfig.clientId &&
    googleDriveConfig.clientSecret &&
    googleDriveConfig.refreshToken
  );
}

export const ADMIN_MASTER_PIN: string = process.env.EXPO_PUBLIC_ADMIN_MASTER_PIN ?? "";
export const DEV_UID: string = process.env.EXPO_PUBLIC_DEV_UID ?? "";
export const DEV_EMAIL: string = (process.env.EXPO_PUBLIC_DEV_EMAIL ?? "").toLowerCase().trim();

export function isOfficialDevAccount(user: { email?: string | null; uid?: string | null } | null | undefined): boolean {
  if (!user) return false;
  const email = (user.email || "").toLowerCase().trim();
  const uid = user.uid || "";
  if (DEV_EMAIL && email === DEV_EMAIL) return true;
  if (DEV_UID && uid === DEV_UID) return true;
  return false;
}
