import { useState, useEffect } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  sendPasswordResetEmail,
  updatePassword,
  updateEmail,
  verifyBeforeUpdateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User 
} from "firebase/auth";
import NetInfo from "@react-native-community/netinfo";
import { getFirebaseAuth } from "../services/firebase/client";
import { 
  getCredentials, 
  clearCredentials, 
  saveUid, 
  getUid, 
  saveCredentials, 
  updateStoredPassword, 
  updateStoredEmail 
} from "../services/auth-storage";

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

let globalUser: User | null = null;
let globalLoading = true;
let isInitialized = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
}

async function ensureAuthInitialized() {
  if (isInitialized) return;
  isInitialized = true;

  const auth = getFirebaseAuth();

  // 1. Carrega imediatamente do SecureStore para pular a tela de login (Offline First)
  try {
    const [creds, storedUid] = await Promise.all([getCredentials(), getUid()]);
    if (creds && creds.email) {
      const uid = storedUid || "local-session";
      globalUser = { email: creds.email, uid } as User;
      globalLoading = false;
      notify();
    }
  } catch (e) {
    console.error("Erro ao ler credenciais locais", e);
  }

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

  onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      console.log("[Auth] Sessão Firebase restaurada com sucesso.");
      void saveUid(firebaseUser.uid);
      globalUser = firebaseUser;
      globalLoading = false;
      notify();
    } else {
      try {
        const creds = await getCredentials();
        if (creds && creds.email && creds.pass) {
          await trySilentLogin("auth-state-changed");
        } else {
          console.log("[Auth] Nenhuma credencial encontrada. Movendo para tela de login.");
          globalUser = null;
          globalLoading = false;
          notify();
        }
      } catch (err: any) {
        console.error("[Auth] Falha no login silencioso (provavelmente offline):", err.message);
        globalLoading = false;
        notify();
      }
    }
  });

  NetInfo.addEventListener((state) => {
    const isOnline = !!state.isConnected && state.isInternetReachable !== false;
    if (!isOnline) return;
    if (auth.currentUser) return;
    void trySilentLogin("network-restored");
  });

  setTimeout(() => {
    if (globalLoading) {
      globalLoading = false;
      notify();
    }
  }, 3000);
}

export function formatAuthError(error: any): string {
  if (!error) return "Ocorreu um erro desconhecido.";
  const code = error.code || "";
  const msg = error.message || "";

  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Senha incorreta. Verifique e tente novamente.";
    case "auth/user-not-found":
      return "Nenhuma conta encontrada com este e-mail.";
    case "auth/invalid-email":
      return "E-mail com formato inválido.";
    case "auth/email-already-in-use":
      return "Este e-mail já está sendo utilizado por outra conta.";
    case "auth/weak-password":
      return "A senha é muito fraca. Deve conter pelo menos 6 caracteres.";
    case "auth/requires-recent-login":
      return "Sua sessão expirou para esta ação. Reautentique com sua senha atual.";
    case "auth/too-many-requests":
      return "Muitas tentativas sem sucesso. Aguarde alguns instantes e tente novamente.";
    case "auth/network-request-failed":
      return "Sem conexão com a internet. Verifique sua rede e tente novamente.";
    case "auth/user-disabled":
      return "Esta conta foi suspensa ou desativada.";
    case "auth/operation-not-allowed":
      return "Operação não autorizada nas configurações do Firebase.";
    default:
      if (msg.includes("auth/network-request-timeout")) {
        return "Tempo limite esgotado. Verifique sua conexão com a internet.";
      }
      return msg || "Ocorreu uma falha na autenticação.";
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(globalUser);
  const [loading, setLoading] = useState(globalLoading);

  useEffect(() => {
    void ensureAuthInitialized();
    const update = () => {
      setUser(globalUser);
      setLoading(globalLoading);
    };
    listeners.add(update);
    update();
    return () => {
      listeners.delete(update);
    };
  }, []);

  return {
    user,
    loading,
    signIn: (email: string, pass: string) => withTimeout(signInWithEmailAndPassword(getFirebaseAuth(), email, pass)),
    signUp: (email: string, pass: string) => withTimeout(createUserWithEmailAndPassword(getFirebaseAuth(), email, pass)),
    sendPasswordReset: async (targetEmail: string) => {
      const cleanEmail = targetEmail.trim();
      if (!cleanEmail) {
        throw new Error("Informe o e-mail cadastrado.");
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        throw new Error("Formato de e-mail inválido.");
      }
      try {
        await withTimeout(sendPasswordResetEmail(getFirebaseAuth(), cleanEmail));
      } catch (err: any) {
        throw new Error(formatAuthError(err));
      }
    },
    changePassword: async (currentPassword: string, newPassword: string) => {
      const auth = getFirebaseAuth();
      let currentUser = auth.currentUser;

      if (!currentUser) {
        const creds = await getCredentials();
        if (creds && creds.email && creds.pass) {
          try {
            const res = await withTimeout(signInWithEmailAndPassword(auth, creds.email, creds.pass));
            currentUser = res.user;
          } catch {}
        }
      }

      if (!currentUser || !currentUser.email) {
        throw new Error("Usuário não autenticado no Firebase.");
      }

      const cleanCurrent = currentPassword.trim();
      if (!cleanCurrent) {
        throw new Error("Informe a senha atual para confirmar a alteração.");
      }

      const cleanNew = newPassword.trim();
      if (!cleanNew || cleanNew.length < 6) {
        throw new Error("A nova senha deve ter no mínimo 6 caracteres.");
      }

      if (cleanCurrent === cleanNew) {
        throw new Error("A nova senha deve ser diferente da senha atual.");
      }

      try {
        const credential = EmailAuthProvider.credential(currentUser.email, cleanCurrent);
        await withTimeout(reauthenticateWithCredential(currentUser, credential));
        await withTimeout(updatePassword(currentUser, cleanNew));
        await updateStoredPassword(cleanNew);
        console.log("[Auth] Senha alterada com sucesso.");
      } catch (err: any) {
        throw new Error(formatAuthError(err));
      }
    },
    changeEmail: async (currentPassword: string, newEmail: string) => {
      const auth = getFirebaseAuth();
      let currentUser = auth.currentUser;

      if (!currentUser) {
        const creds = await getCredentials();
        if (creds && creds.email && creds.pass) {
          try {
            const res = await withTimeout(signInWithEmailAndPassword(auth, creds.email, creds.pass));
            currentUser = res.user;
          } catch {}
        }
      }

      if (!currentUser || !currentUser.email) {
        throw new Error("Usuário não autenticado no Firebase.");
      }

      const cleanEmail = newEmail.trim().toLowerCase();
      if (!cleanEmail) {
        throw new Error("Informe o novo endereço de e-mail.");
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        throw new Error("Formato de e-mail inválido.");
      }

      if (cleanEmail === currentUser.email.toLowerCase()) {
        throw new Error("O novo e-mail deve ser diferente do e-mail atual.");
      }

      const cleanCurrent = currentPassword.trim();
      if (!cleanCurrent) {
        throw new Error("Informe a senha atual para autorizar a troca de e-mail.");
      }

      try {
        const credential = EmailAuthProvider.credential(currentUser.email, cleanCurrent);
        await withTimeout(reauthenticateWithCredential(currentUser, credential));

        let verificationSent = false;
        let successMessage = "";

        try {
          if (typeof verifyBeforeUpdateEmail === "function") {
            await withTimeout(verifyBeforeUpdateEmail(currentUser, cleanEmail));
            verificationSent = true;
            successMessage = `E-mail de confirmação enviado para ${cleanEmail}. Confirme o link no novo e-mail para validar a alteração.`;
          } else {
            await withTimeout(updateEmail(currentUser, cleanEmail));
            successMessage = `E-mail atualizado para ${cleanEmail} com sucesso!`;
          }
        } catch (verifyErr: any) {
          if (verifyErr.code === "auth/operation-not-allowed") {
            await withTimeout(updateEmail(currentUser, cleanEmail));
            successMessage = `E-mail atualizado para ${cleanEmail} com sucesso!`;
          } else {
            throw verifyErr;
          }
        }

        if (!verificationSent) {
          await updateStoredEmail(cleanEmail);
          globalUser = auth.currentUser;
          notify();
        }

        return { verificationSent, message: successMessage };
      } catch (err: any) {
        throw new Error(formatAuthError(err));
      }
    },
    sendCurrentUserPasswordReset: async () => {
      const auth = getFirebaseAuth();
      const targetEmail = auth.currentUser?.email || globalUser?.email;
      if (!targetEmail) {
        throw new Error("E-mail da conta não encontrado.");
      }
      try {
        await withTimeout(sendPasswordResetEmail(auth, targetEmail));
        return {
          success: true,
          message: `Link de redefinição enviado para ${targetEmail}. Verifique sua caixa de entrada e pasta de spam.`
        };
      } catch (err: any) {
        throw new Error(formatAuthError(err));
      }
    },
    logout: async () => {
      try {
        const { useChatStore } = require("../store/chat-store");
        const { useCaixaStore } = require("../store/caixa-store");
        useChatStore.getState().setMyProfile(null);
        useChatStore.getState().setMensagens([]);
        useChatStore.getState().setContatos([]);
        useChatStore.getState().setPresencas([]);
        useCaixaStore.setState({ 
          turno: null, 
          transacoes: [], 
          fantasmas: [], 
          registrosPOS: [], 
          registrosConvenio: [], 
          logs: [], 
          historicoTurnos: [] 
        });
        const { clearCurrentShiftCache, clearHistoricoTurnosCache } = require("../services/local-storage");
        await Promise.all([
          clearCurrentShiftCache(),
          clearHistoricoTurnosCache()
        ]);
      } catch {}
      await clearCredentials();
      globalUser = null;
      notify();
      return signOut(getFirebaseAuth());
    }
  };
}
