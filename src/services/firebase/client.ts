import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
// @ts-ignore
import { Auth, getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import { initializeFirestore, persistentLocalCache } from "firebase/firestore";
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

// Configuração do Firestore com suporte offline
let firestoreDb: any;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache()
  });
} catch (e) {
  // Caso de Hot Reload
  // Precisamos importar o getFirestore normalmente aqui, mas vamos apenas pegar via import se falhar
  const { getFirestore } = require("firebase/firestore");
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
