import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { firebaseConfig, hasFirebaseConfig } from "../../config/env";

let app: FirebaseApp;

export function getFirebaseApp(): FirebaseApp {
  if (!hasFirebaseConfig()) {
    throw new Error(
      "Firebase nao configurado. Defina as variaveis EXPO_PUBLIC_FIREBASE_* no ambiente."
    );
  }

  if (getApps().length > 0) {
    return getApp();
  }

  app = initializeApp(firebaseConfig);
  return app;
}

