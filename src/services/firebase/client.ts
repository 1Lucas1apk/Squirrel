import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";

import { firebaseConfig, hasFirebaseConfig } from "../../config/env";

export function getFirebaseApp(): FirebaseApp {
  if (!hasFirebaseConfig()) {
    throw new Error(
      "Firebase nao configurado. Defina as variaveis EXPO_PUBLIC_FIREBASE_* no ambiente."
    );
  }

  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(firebaseConfig);
}
