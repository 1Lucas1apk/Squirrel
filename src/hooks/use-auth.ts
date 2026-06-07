import { useState, useEffect } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  User 
} from "firebase/auth";
import NetInfo from "@react-native-community/netinfo";
import { getFirebaseAuth } from "../services/firebase/client";
import { getCredentials, clearCredentials } from "../services/auth-storage";

const AUTH_TIMEOUT_MS = 8000;
let silentLoginInFlight = false;
let lastSilentAttemptAt = 0;

function withTimeout<T>(promise: Promise<T>, timeoutMs = AUTH_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("auth/network-request-timeout")), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    let isMounted = true;
    
    // 1. Carrega imediatamente do SecureStore para pular a tela de login (Offline First)
    async function checkLocalSession() {
      try {
        const creds = await getCredentials();
        if (creds && creds.email && isMounted) {
          setUser({ email: creds.email, uid: "local-session" } as User);
          setLoading(false);
        }
      } catch (e) {
        console.error("Erro ao ler credenciais locais", e);
      }
    }
    
    checkLocalSession();

    // 2. Firebase tenta restaurar a sessão em segundo plano
    const trySilentLogin = async (reason: string) => {
      if (silentLoginInFlight) return;
      if (Date.now() - lastSilentAttemptAt < 6000) return;

      const creds = await getCredentials();
      if (!(creds && creds.email && creds.pass)) {
        return;
      }

      silentLoginInFlight = true;
      lastSilentAttemptAt = Date.now();
      console.log(`[Auth] Tentando re-login silencioso (${reason})...`);
      try {
        await withTimeout(signInWithEmailAndPassword(auth, creds.email, creds.pass));
      } finally {
        silentLoginInFlight = false;
      }
    };

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted) return;

      if (firebaseUser) {
        console.log("[Auth] Sessão Firebase restaurada com sucesso.");
        setUser(firebaseUser);
        setLoading(false);
      } else {
        // Se o Firebase não tem sessão, tentamos logar silenciosamente usando as credenciais do SecureStore
        try {
          const creds = await getCredentials();
          if (creds && creds.email && creds.pass) {
            await trySilentLogin("auth-state-changed");
            // Ao ter sucesso, onAuthStateChanged dispara novamente entrando no bloco 'if (firebaseUser)'.
          } else {
            console.log("[Auth] Nenhuma credencial encontrada. Movendo para tela de login.");
            setUser(null);
            setLoading(false);
          }
        } catch (err: any) {
          console.error("[Auth] Falha no login silencioso (provavelmente offline):", err.message);
          // Se falhar (ex: sem internet), o usuário continua logado na sessão local (Offline).
          // Não chamamos setUser(null) aqui para não expulsar o usuário se ele estiver sem rede.
          setLoading(false);
        }
      }
    });

    const unsubscribeNet = NetInfo.addEventListener((state) => {
      const isOnline = !!state.isConnected && state.isInternetReachable !== false;
      if (!isOnline) return;
      if (auth.currentUser) return;
      void trySilentLogin("network-restored");
    });

    return () => {
      isMounted = false;
      unsubscribe();
      unsubscribeNet();
    };
  }, []);

  return {
    user,
    loading,
    signIn: (email: string, pass: string) => withTimeout(signInWithEmailAndPassword(getFirebaseAuth(), email, pass)),
    signUp: (email: string, pass: string) => withTimeout(createUserWithEmailAndPassword(getFirebaseAuth(), email, pass)),
    logout: async () => {
      await clearCredentials();
      setUser(null); // Força a saída na UI imediatamente
      return signOut(getFirebaseAuth());
    }
  };
}
