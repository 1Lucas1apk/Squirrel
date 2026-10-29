import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
// @ts-ignore
import { Auth, getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import { initializeFirestore, memoryLocalCache, getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { firebaseConfig, hasFirebaseConfig } from "../../config/env";

// Inicialização ultra-limpa para garantir compatibilidade
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Configuração explícita de persistência para evitar deslogar no Android
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (e) {
  // Já foi inicializado (ex: Hot Reload)
  auth = getAuth(app);
}

// Configuração do Firestore otimizada para React Native (sem IndexedDB no Android)
// A persistência offline do app é gerenciada nativamente pelo MMKV / local-storage
let firestoreDb: any;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: memoryLocalCache(),
  });
} catch (e) {
  firestoreDb = getFirestore(app);
}

export function getFirebaseApp(): FirebaseApp {
  return app;
}

export function getFirebaseAuth(): Auth {
  return auth;
}

export function getFirestoreDb() {
  return firestoreDb;
}
