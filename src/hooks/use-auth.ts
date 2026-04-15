import { useState, useEffect } from "react";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  User 
} from "firebase/auth";
import { getFirebaseApp } from "../services/firebase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const auth = getAuth(getFirebaseApp());
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (e) {
      setLoading(false);
    }
  }, []);

  return {
    user,
    loading,
    signIn: (email: string, pass: string) => signInWithEmailAndPassword(getAuth(getFirebaseApp()), email, pass),
    signUp: (email: string, pass: string) => createUserWithEmailAndPassword(getAuth(getFirebaseApp()), email, pass),
    logout: () => signOut(getAuth(getFirebaseApp()))
  };
}
