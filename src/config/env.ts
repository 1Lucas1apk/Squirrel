const defaultFirebaseConfig = {
  apiKey: "AIzaSyBd9LVjWgiXkJ9zlZvLmL55FHi93FwzLB0",
  authDomain: "squirrel-383ea.firebaseapp.com",
  databaseURL: "https://squirrel-383ea-default-rtdb.firebaseio.com",
  projectId: "squirrel-383ea",
  storageBucket: "squirrel-383ea.firebasestorage.app",
  messagingSenderId: "1070608699778",
  appId: "1:1070608699778:web:17f7728b1677df064fbf9b",
};

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? defaultFirebaseConfig.apiKey,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? defaultFirebaseConfig.authDomain,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ?? defaultFirebaseConfig.databaseURL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? defaultFirebaseConfig.projectId,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? defaultFirebaseConfig.storageBucket,
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? defaultFirebaseConfig.messagingSenderId,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? defaultFirebaseConfig.appId,
};

export function hasFirebaseConfig(): boolean {
  return Object.values(firebaseConfig).every((value) => Boolean(value));
}
