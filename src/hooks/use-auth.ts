import { useState, useEffect } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  User 
} from "firebase/auth";
import { getFirebaseAuth } from "../services/firebase/client";
import { getCredentials, clearCredentials } from "../services/auth-storage";

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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted) return;

      if (firebaseUser) {
        setUser(firebaseUser);
        setLoading(false);
      } else {
        // Se o Firebase não tem sessão, tentamos logar silenciosamente
        try {
          const creds = await getCredentials();
          if (creds && creds.email && creds.pass) {
            await signInWithEmailAndPassword(auth, creds.email, creds.pass);
            // Ao ter sucesso, onAuthStateChanged dispara novamente.
          } else {
            setUser(null);
            setLoading(false);
          }
        } catch (err: any) {
          console.error("Erro no login silencioso (provavelmente offline):", err.message);
          // Se falhar (ex: sem internet), o usuário continua logado na sessão local (Offline).
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return {
    user,
    loading,
    signIn: (email: string, pass: string) => signInWithEmailAndPassword(getFirebaseAuth(), email, pass),
    signUp: (email: string, pass: string) => createUserWithEmailAndPassword(getFirebaseAuth(), email, pass),
    logout: async () => {
      await clearCredentials();
      setUser(null); // Força a saída na UI imediatamente
      return signOut(getFirebaseAuth());
    }
  };
}
