import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocsFromCache,
  onSnapshot,
  query,
  orderBy,
  limit,
  updateDoc,
  where,
  getDocs,
  deleteDoc,
  arrayUnion,
  writeBatch
} from "firebase/firestore";
import { getFirestoreDb, getFirebaseAuth } from "../firebase/client";
import { MensagemChat, ChatContact, JogoChatPayload } from "../../types/domain";
import { Unsubscribe } from "firebase/auth";

function mapMensagem(id: string, data: any): MensagemChat {
  return {
    id,
    remetenteId: String(data.remetenteId || ""),
    remetenteNome: String(data.remetenteNome || "Desconhecido"),
    remetenteUsername: data.remetenteUsername ? String(data.remetenteUsername) : undefined,
    remetenteCargo: data.remetenteCargo ? String(data.remetenteCargo) : undefined,
    destinatarioId: data.destinatarioId || undefined,
    parentId: data.parentId || undefined,
    replyTo: data.replyTo || undefined,
    reacoes: typeof data.reacoes === "object" && data.reacoes !== null ? data.reacoes : {},
    texto: String(data.texto || ""),
    imagemBase64: data.imagemBase64 || undefined,
    remetentePhotoUrl: data.remetentePhotoUrl ? String(data.remetentePhotoUrl) : undefined,
    remetenteRecado: data.remetenteRecado ? String(data.remetenteRecado) : undefined,
    remetenteStatusPreset: data.remetenteStatusPreset ? String(data.remetenteStatusPreset) : undefined,
    isPinned: Boolean(data.isPinned),
    timestamp: Number(data.timestamp || 0),
    lidasPor: Array.isArray(data.lidasPor) ? data.lidasPor : [],
    editadaEm: data.editadaEm ? Number(data.editadaEm) : undefined,
    apagadaEm: data.apagadaEm ? Number(data.apagadaEm) : undefined,
    jogo: data.jogo || undefined,
  };
}

export async function apagarMensagemChat(mensagemId: string): Promise<void> {
  if (!mensagemId) return;
  const db = getFirestoreDb();
  const msgRef = doc(db, `chat_global_messages/${mensagemId}`);
  await updateDoc(msgRef, {
    apagadaEm: Date.now()
  });
}

export async function excluirMensagemPermanenteChat(mensagemId: string): Promise<void> {
  if (!mensagemId) return;
  const db = getFirestoreDb();
  const msgRef = doc(db, `chat_global_messages/${mensagemId}`);
  await deleteDoc(msgRef);
}

export async function editarMensagemChat(mensagemId: string, novoTexto: string): Promise<void> {
  if (!mensagemId || !novoTexto) return;
  const db = getFirestoreDb();
  const msgRef = doc(db, `chat_global_messages/${mensagemId}`);
  await updateDoc(msgRef, {
    texto: novoTexto,
    editadaEm: Date.now()
  });
}

export async function desafixarAvisoMural(mensagemId: string): Promise<void> {
  if (!mensagemId) return;
  const db = getFirestoreDb();
  const msgRef = doc(db, `chat_global_messages/${mensagemId}`);
  await updateDoc(msgRef, {
    isPinned: false
  });
}

export async function alternarFixarMensagemMuralChat(mensagemId: string, isPinned: boolean): Promise<void> {
  if (!mensagemId) return;
  const db = getFirestoreDb();
  const msgRef = doc(db, `chat_global_messages/${mensagemId}`);
  await updateDoc(msgRef, {
    isPinned: Boolean(isPinned)
  });
}

export async function limparMuralGeralChat(): Promise<number> {
  const db = getFirestoreDb();
  const q = query(collection(db, "chat_global_messages"), limit(500));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (!data.destinatarioId) {
      batch.delete(d.ref);
      count++;
    }
  }
  if (count > 0) {
    await batch.commit();
  }
  return count;
}

export async function limparTodasMensagensChat(): Promise<number> {
  const db = getFirestoreDb();
  const q = query(collection(db, "chat_global_messages"), limit(500));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  let count = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    count++;
  }
  if (count > 0) {
    await batch.commit();
  }
  return count;
}

export async function marcarMensagemComoLidaChat(mensagemId: string, leitorId: string): Promise<void> {
  if (!mensagemId || !leitorId) return;
  const db = getFirestoreDb();
  const msgRef = doc(db, `chat_global_messages/${mensagemId}`);
  await updateDoc(msgRef, {
    lidasPor: arrayUnion(leitorId)
  }).catch(() => {});
}

export async function marcarConversaComoLidaChat(
  remetenteId: string, 
  meuId: string, 
  meuUsername?: string, 
  remetenteUsername?: string
): Promise<void> {
  if (!remetenteId || !meuId) return;
  const db = getFirestoreDb();
  const colRef = collection(db, "chat_global_messages");

  // Precisamos buscar mensagens onde:
  //   remetenteId == contactId|contactUsername E destinatarioId == meuId|meuUsername
  // Firestore não suporta OR em campos diferentes, então fazemos queries combinadas
  const remetenteKeys = [remetenteId];
  if (remetenteUsername) {
    const cleanRU = remetenteUsername.toLowerCase().replace(/^@/, "").trim();
    if (cleanRU && cleanRU !== remetenteId.toLowerCase()) remetenteKeys.push(cleanRU);
  }

  const meuKeys = [meuId];
  if (meuUsername) {
    const cleanMU = meuUsername.toLowerCase().replace(/^@/, "").trim();
    if (cleanMU && cleanMU !== meuId.toLowerCase()) meuKeys.push(cleanMU);
  }

  try {
    const allDocs = new Map<string, any>();

    for (const rk of remetenteKeys) {
      for (const mk of meuKeys) {
        const q = query(colRef, where("remetenteId", "==", rk), where("destinatarioId", "==", mk), limit(50));
        try {
          const snap = await Promise.race([
            getDocs(q),
            new Promise<any>((_, rej) => setTimeout(() => rej(new Error("timeout")), 1500))
          ]);
          if (snap && !snap.empty) {
            snap.docs.forEach((d: any) => allDocs.set(d.id, d));
          }
        } catch {
          // Ignora timeout silenciosamente
        }
      }
    }

    if (allDocs.size === 0) return;

    const promises = Array.from(allDocs.values())
      .filter((d: any) => {
        const lidas = d.data().lidasPor || [];
        return !lidas.includes(meuId);
      })
      .map((d: any) => updateDoc(doc(db, "chat_global_messages", d.id), {
        lidasPor: arrayUnion(meuId)
      }));
    if (promises.length > 0) await Promise.all(promises);
  } catch (e) {
    console.log("[ChatRepo] Erro ao marcar conversa como lida:", e);
  }
}

export async function alternarReacaoMensagemChat(
  mensagemId: string,
  emoji: string,
  userId: string
): Promise<void> {
  if (!mensagemId || !emoji || !userId) return;
  const db = getFirestoreDb();
  const msgRef = doc(db, `chat_global_messages/${mensagemId}`);

  try {
    let snap: any;
    try {
      snap = await Promise.race([
        getDoc(msgRef),
        new Promise<any>((_, rej) => setTimeout(() => rej(new Error("timeout")), 1200))
      ]);
    } catch {
      snap = await getDoc(msgRef).catch(() => null);
    }

    if (!snap || !snap.exists()) return;

    const data = snap.data();
    const currentReacoes: Record<string, string[]> = data?.reacoes || {};
    const currentUsersForEmoji: string[] = currentReacoes[emoji] || [];

    let updatedUsers: string[];
    if (currentUsersForEmoji.includes(userId)) {
      // Remove a reação se já clicou nela
      updatedUsers = currentUsersForEmoji.filter(u => u !== userId);
    } else {
      // Adiciona a nova reação
      updatedUsers = [...currentUsersForEmoji, userId];
    }

    const updatedReacoes = { ...currentReacoes };
    if (updatedUsers.length > 0) {
      updatedReacoes[emoji] = updatedUsers;
    } else {
      delete updatedReacoes[emoji];
    }

    await updateDoc(msgRef, {
      reacoes: updatedReacoes
    });
  } catch (e) {
    console.warn("[ChatRepo] Erro ao alternar reação:", e);
  }
}

function sanitizeFirestorePayload(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    // Firestore proíbe terminantemente matrizes aninhadas (array de array)
    const hasNested = obj.some(item => Array.isArray(item));
    const target = hasNested ? obj.flat(Infinity) : obj;
    return target.map(sanitizeFirestorePayload);
  }
  const result: any = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    result[key] = val === undefined ? null : sanitizeFirestorePayload(val);
  }
  return result;
}

export async function enviarMensagemChat(
  mensagem: Omit<MensagemChat, "id" | "timestamp" | "lidasPor">
): Promise<string> {
  const db = getFirestoreDb();
  
  const msgRef = doc(collection(db, `chat_global_messages`));
  const payload: any = {
    remetenteId: mensagem.remetenteId || "",
    remetenteNome: mensagem.remetenteNome || "Desconhecido",
    remetenteUsername: mensagem.remetenteUsername ?? null,
    remetenteCargo: mensagem.remetenteCargo ?? "atendente",
    remetentePhotoUrl: mensagem.remetentePhotoUrl ?? null,
    remetenteRecado: mensagem.remetenteRecado ?? null,
    remetenteStatusPreset: mensagem.remetenteStatusPreset ?? null,
    destinatarioId: mensagem.destinatarioId ?? null,
    parentId: mensagem.parentId ?? null,
    replyTo: mensagem.replyTo ?? null,
    reacoes: mensagem.reacoes ?? {},
    texto: mensagem.texto || "",
    imagemBase64: mensagem.imagemBase64 ?? null,
    isPinned: Boolean(mensagem.isPinned),
    timestamp: Date.now(),
    lidasPor: [mensagem.remetenteId],
    jogo: mensagem.jogo ?? null,
  };

  const safePayload = sanitizeFirestorePayload(payload);
  await setDoc(msgRef, safePayload);
  return msgRef.id;
}

export async function atualizarEstadoJogoChat(
  mensagemId: string,
  novoPayloadJogo: JogoChatPayload
): Promise<void> {
  if (!mensagemId || !novoPayloadJogo) return;
  const db = getFirestoreDb();
  const msgRef = doc(db, `chat_global_messages/${mensagemId}`);
  const safeJogo = sanitizeFirestorePayload(novoPayloadJogo);
  await updateDoc(msgRef, {
    jogo: safeJogo
  });
}

export function ouvirMensagensChat(onData: (mensagens: MensagemChat[]) => void): Unsubscribe {
  const db = getFirestoreDb();
  const q = query(
    collection(db, `chat_global_messages`),
    orderBy("timestamp", "desc"),
    limit(80)
  );

  const unsub = onSnapshot(q, (snap) => {
    const arr = snap.docs.map(d => mapMensagem(d.id, d.data()));
    onData(arr.reverse());
  }, (err) => {
    console.log("[ChatRepo] Erro ao ouvir mensagens:", err);
  });

  return unsub;
}

export async function obterPerfilUsuario(userId: string): Promise<{ username?: string; displayName?: string; isAdmin?: boolean; cargo?: string; photoUrl?: string | null; recado?: string | null; statusPreset?: string | null } | null> {
  if (!userId) return null;
  const db = getFirestoreDb();
  const userRef = doc(db, `chat_users/${userId}`);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    const data = snap.data();
    return {
      username: data?.username ? String(data.username) : undefined,
      displayName: data?.displayName ? String(data.displayName) : undefined,
      isAdmin: Boolean(data?.isAdmin),
      cargo: data?.cargo ? String(data.cargo) : (data?.isAdmin ? "admin" : "atendente"),
      photoUrl: data?.photoUrl ? String(data.photoUrl) : (data?.photoUrl === null ? null : undefined),
      recado: data?.recado ? String(data.recado) : (data?.recado === null ? null : undefined),
      statusPreset: data?.statusPreset ? String(data.statusPreset) : (data?.statusPreset === null ? null : undefined)
    };
  }
  return null;
}

import { DEV_UID, DEV_EMAIL } from "../../config/env";
export { DEV_UID, DEV_EMAIL };

export function ouvirPerfilUsuario(userId: string, onData: (profile: any) => void): Unsubscribe {
  const db = getFirestoreDb();
  const userRef = doc(db, `chat_users/${userId}`);
  return onSnapshot(userRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      if (data) {
        const isAdminUser = Boolean(data.isAdmin);
        const isOfficialDev = userId === DEV_UID || String(data.email || "").toLowerCase().trim() === DEV_EMAIL;
        const cRaw = (data.cargo || "").toLowerCase().trim();
        const isDevCargo = isOfficialDev && (cRaw === "dev" || cRaw === "desenvolvedor" || cRaw === "developer");
        const resolvedCargo = isDevCargo ? "dev" : (isAdminUser ? "admin" : (data.cargo === "dev" ? "atendente" : (data.cargo || "atendente")));
        onData({
          username: String(data.username || ""),
          displayName: String(data.displayName || data.username || ""),
          isAdmin: isAdminUser,
          cargo: resolvedCargo,
          photoUrl: data.photoUrl ? String(data.photoUrl) : (data.photoUrl === null ? null : undefined),
          recado: data.recado ? String(data.recado) : (data.recado === null ? null : undefined),
          statusPreset: data.statusPreset ? String(data.statusPreset) : (data.statusPreset === null ? null : undefined)
        });
      }
    }
  });
}

export async function registrarPresencaUsuario(
  userId: string, 
  fallbackUsername: string, 
  fallbackDisplayName: string, 
  isOnline: boolean = true,
  userEmail?: string
): Promise<{ username?: string; displayName?: string; isAdmin?: boolean; cargo?: string; photoUrl?: string }> {
  if (!userId) return {};
  const db = getFirestoreDb();
  const userRef = doc(db, `chat_users/${userId}`);
  const cleanUsername = (fallbackUsername || "usuario").replace(/^@/, "").toLowerCase().trim();
  const cleanDisplayName = (fallbackDisplayName || fallbackUsername || "Operador").trim();

  try {
    const userSnap = await getDoc(userRef).catch(() => null);

    // Se falhou ao buscar o documento por estar offline ou timeout (userSnap === null),
    // NUNCA escreve fallbacks de email para evitar corromper o nome e nick do usuário!
    if (!userSnap) {
      return {
        username: cleanUsername,
        displayName: cleanDisplayName,
        isAdmin: false,
        cargo: "atendente"
      };
    }

    // CASO 1: O documento já existe no Firestore!
    // ATUALIZAÇÃO ESTRITA DE PRESENÇA (Heartbeat puro):
    // JAMAIS sobrescreve username, displayName nem updatedAt!
    if (userSnap.exists()) {
      const existingUser = userSnap.data();
      const presencePayload: Record<string, any> = {
        id: userId,
        isOnline: isOnline,
        lastSeen: Date.now(),
      };
      if (userEmail && !existingUser?.email) {
        presencePayload.email = userEmail;
      }
      await setDoc(userRef, presencePayload, { merge: true });

      const currentAdmin = existingUser?.isAdmin !== undefined 
        ? Boolean(existingUser.isAdmin) 
        : false;
      const currentCargo = currentAdmin 
        ? "admin" 
        : (existingUser?.cargo && existingUser.cargo !== "admin" ? existingUser.cargo : "atendente");

      return {
        username: existingUser?.username || cleanUsername,
        displayName: existingUser?.displayName || cleanDisplayName,
        isAdmin: currentAdmin,
        cargo: currentCargo || "atendente",
        photoUrl: existingUser?.photoUrl
      };
    }

    // CASO 2: Documento CONFIRMADAMENTE não existe no Firestore (primeiro login do usuário na vida).
    // Cria o perfil inicial apenas uma única vez.
    const initialPayload: Record<string, any> = {
      id: userId,
      username: cleanUsername,
      displayName: cleanDisplayName,
      isOnline: isOnline,
      isAdmin: false,
      cargo: "atendente",
      lastSeen: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...(userEmail ? { email: userEmail } : {})
    };

    await setDoc(userRef, initialPayload, { merge: true });

    return {
      username: cleanUsername,
      displayName: cleanDisplayName,
      isAdmin: false,
      cargo: "atendente"
    };
  } catch (e) {
    console.log("[ChatRepo] Erro ao registrar presença:", e);
    return {
      username: cleanUsername,
      displayName: cleanDisplayName,
      isAdmin: false,
      cargo: "atendente"
    };
  }
}

export async function verificarDisponibilidadeUsername(
  novoUsername: string,
  myUserId: string
): Promise<{ disponivel: boolean; motivo?: string }> {
  const clean = novoUsername.toLowerCase().replace(/[^a-z0-9_]/g, "").trim();
  if (clean.length < 3) {
    return { disponivel: false, motivo: "Mínimo de 3 caracteres (letras, números e _)" };
  }
  if (clean.length > 25) {
    return { disponivel: false, motivo: "Máximo de 25 caracteres" };
  }

  const db = getFirestoreDb();
  const q = query(collection(db, "chat_users"), where("username", "==", clean), limit(1));
  const snap = await getDocs(q);

  if (!snap.empty) {
    const docSnap = snap.docs[0];
    const docId = docSnap.id;
    const data = docSnap.data();
    const currentUid = getFirebaseAuth()?.currentUser?.uid;
    const currentEmail = getFirebaseAuth()?.currentUser?.email;

    const isSameUser = 
      docId === myUserId || 
      data.id === myUserId || 
      data.userId === myUserId ||
      (currentUid && (docId === currentUid || data.id === currentUid || data.userId === currentUid)) ||
      (currentEmail && (data.email === currentEmail || docId === currentEmail.replace(/[^a-zA-Z0-9]/g, "_")));

    if (!isSameUser) {
      return { disponivel: false, motivo: "Este @username já está em uso por outro usuário." };
    }
  }

  return { disponivel: true };
}

export async function alterarUsernameComSeguranca(
  myUserId: string,
  antigoUsername: string,
  novoUsername: string,
  novoNome: string,
  isAdmin: boolean,
  cargo?: string,
  photoUrl?: string | null,
  recado?: string | null,
  statusPreset?: string | null
): Promise<{ success: boolean; error?: string; cleanUsername?: string }> {
  const cleanUser = novoUsername.toLowerCase().replace(/[^a-z0-9_]/g, "").trim();
  const cleanOld = antigoUsername ? antigoUsername.toLowerCase().replace(/[^a-z0-9_]/g, "").trim() : "";
  const cleanName = novoNome.trim() || cleanUser;

  if (cleanUser.length < 3) {
    return { success: false, error: "O @username deve ter pelo menos 3 caracteres." };
  }

  // Se o username NÃO mudou, NÃO precisa verificar colisão (é o próprio usuário)
  if (cleanOld && cleanUser !== cleanOld) {
    const check = await verificarDisponibilidadeUsername(cleanUser, myUserId);
    if (!check.disponivel) {
      return { success: false, error: check.motivo || "Username indisponível." };
    }
  }

  const db = getFirestoreDb();
  const existingUserRef = doc(db, `chat_users/${myUserId}`);
  const existingSnap = await getDoc(existingUserRef).catch(() => null);
  const existingData = existingSnap && existingSnap.exists() ? existingSnap.data() : null;
  
  const auth = getFirebaseAuth();
  const currentAuthUser = auth.currentUser;
  const isRealDevUser = (currentAuthUser?.email?.toLowerCase().trim() === DEV_EMAIL) || 
                        (myUserId === DEV_UID) ||
                        (existingData?.email && existingData.email.toLowerCase().trim() === DEV_EMAIL);

  const cRaw = (cargo || existingData?.cargo || "").toLowerCase().trim();
  const isDevCargo = isRealDevUser && (cRaw === "dev" || cRaw === "desenvolvedor" || cRaw === "developer");
  const firestoreAdmin = isDevCargo || cargo?.toLowerCase() === "admin" || Boolean(existingData?.isAdmin) || Boolean(isAdmin);
  const firestoreCargo = isDevCargo 
    ? "dev" 
    : (cargo && cargo.toLowerCase() !== "dev" && cargo.toLowerCase() !== "desenvolvedor" 
        ? cargo.toLowerCase().trim() 
        : (firestoreAdmin ? "admin" : (existingData?.cargo && existingData.cargo !== "dev" ? existingData.cargo : "atendente")));

  const payloadToSave: any = {
    id: myUserId,
    username: cleanUser,
    displayName: cleanName,
    isAdmin: firestoreAdmin,
    cargo: firestoreCargo,
    isOnline: true,
    lastSeen: Date.now(),
    updatedAt: Date.now()
  };

  if (photoUrl !== undefined) {
    payloadToSave.photoUrl = photoUrl ? String(photoUrl) : null;
  }

  if (recado !== undefined) {
    payloadToSave.recado = recado && recado.trim() ? recado.trim() : null;
  }

  if (statusPreset !== undefined) {
    payloadToSave.statusPreset = statusPreset && statusPreset.trim() ? statusPreset.trim() : null;
  }

  await setDoc(existingUserRef, payloadToSave, { merge: true });

  return { success: true, cleanUsername: cleanUser };
}

export async function atualizarStatusAdminUsuario(userId: string, isAdmin: boolean): Promise<void> {
  if (!userId) return;
  const db = getFirestoreDb();
  const userRef = doc(db, `chat_users/${userId}`);

  try {
    const userSnap = await getDoc(userRef).catch(() => null);
    const existingUser = userSnap && userSnap.exists() ? userSnap.data() : null;

    const actualUsername = (existingUser?.username || "usuario").toLowerCase().replace(/^@/, "").trim();
    const actualDisplayName = existingUser?.displayName || "Operador";
    const targetCargo = isAdmin ? "admin" : (existingUser?.cargo && existingUser.cargo !== "admin" ? existingUser.cargo : "operador");

    await setDoc(userRef, {
      id: userId,
      username: actualUsername,
      displayName: actualDisplayName,
      isAdmin: Boolean(isAdmin),
      cargo: targetCargo,
      updatedAt: Date.now()
    }, { merge: true });
  } catch (e) {
    console.log("[ChatRepo] Erro ao atualizar status admin:", e);
  }
}

export function ouvirPresencaUsuarios(onData: (usuarios: ChatContact[]) => void): Unsubscribe {
  const db = getFirestoreDb();

  const unsub = onSnapshot(query(collection(db, "chat_users"), limit(100)), (snap) => {
    const users: ChatContact[] = snap.docs.map(d => {
      const data = d.data();
      const lastSeen = Number(data.lastSeen || 0);
      const isRecentlyOnline = (Date.now() - lastSeen) < (3 * 60 * 1000);
      
      const isAdminUser = Boolean(data.isAdmin);
      const isOfficialDev = d.id === DEV_UID || String(data.email || "").toLowerCase().trim() === DEV_EMAIL || (d.id === DEV_UID && String(data.username || "").toLowerCase() === "dev");
      const cRaw = (data.cargo || "").toLowerCase().trim();
      const isDevCargo = isOfficialDev && (cRaw === "dev" || cRaw === "desenvolvedor" || cRaw === "developer" || String(data.username || "").toLowerCase() === "dev");
      const userCargo = isDevCargo ? "dev" : (isAdminUser ? "admin" : (data.cargo === "dev" ? "operador" : (data.cargo || "operador")));

      return {
        id: d.id,
        username: String(data.username || d.id),
        displayName: String(data.displayName || data.username || "Usuário"),
        isAdmin: isAdminUser,
        cargo: userCargo,
        photoUrl: data.photoUrl ? String(data.photoUrl) : undefined,
        recado: data.recado ? String(data.recado) : undefined,
        statusPreset: data.statusPreset ? String(data.statusPreset) : undefined,
        isOnline: Boolean(data.isOnline && isRecentlyOnline),
        lastSeen: lastSeen,
      };
    });
    onData(users);
  }, (err) => {
    console.log("[ChatRepo] Erro ao ouvir presenças:", err);
  });

  return unsub;
}

export async function buscarUsuarioPorTag(tag: string): Promise<ChatContact | null> {
  const clean = tag.replace(/^@/, "").toLowerCase().trim();
  if (!clean) return null;

  const db = getFirestoreDb();
  const q = query(collection(db, "chat_users"), where("username", "==", clean), limit(1));
  let querySnap;
  try {
    querySnap = await Promise.race([
      getDocs(q),
      new Promise<any>((_, rej) => setTimeout(() => rej(new Error("timeout")), 1200))
    ]);
  } catch {
    querySnap = await getDocsFromCache(q).catch(() => null);
  }

  if (querySnap && !querySnap.empty) {
    const docData = querySnap.docs[0].data();
    const isAdminUser = Boolean(docData?.isAdmin);
    const isOfficialDev = querySnap.docs[0].id === DEV_UID || String(docData?.email || "").toLowerCase().trim() === DEV_EMAIL;
    const cRaw = (docData?.cargo || "").toLowerCase().trim();
    const isDevCargo = isOfficialDev && (cRaw === "dev" || cRaw === "desenvolvedor" || cRaw === "developer" || clean === "dev");
    const userCargo = isDevCargo ? "dev" : (isAdminUser ? "admin" : (docData?.cargo === "dev" ? "operador" : (docData?.cargo || "operador")));
    return {
      id: querySnap.docs[0].id,
      username: clean,
      displayName: String(docData?.displayName || clean),
      isAdmin: isAdminUser,
      cargo: userCargo,
      photoUrl: docData?.photoUrl ? String(docData.photoUrl) : undefined,
      recado: docData?.recado ? String(docData.recado) : undefined,
      statusPreset: docData?.statusPreset ? String(docData.statusPreset) : undefined,
      isOnline: Boolean(docData?.isOnline),
    };
  }

  return null;
}

export async function salvarContatoUsuario(myUserId: string, contato: ChatContact): Promise<void> {
  if (!myUserId || !contato.id) return;
  const db = getFirestoreDb();
  const contactRef = doc(db, `chat_users/${myUserId}/contacts/${contato.id}`);
  await setDoc(contactRef, {
    id: contato.id,
    username: contato.username,
    displayName: contato.displayName,
    isAdmin: Boolean(contato.isAdmin),
    cargo: contato.cargo || (contato.isAdmin ? "admin" : "operador"),
    photoUrl: contato.photoUrl || null,
    recado: contato.recado || null,
    statusPreset: contato.statusPreset || null,
    addedAt: Date.now()
  }, { merge: true });
}

export function ouvirContatosUsuario(myUserId: string, onData: (contatos: ChatContact[]) => void): Unsubscribe {
  if (!myUserId) {
    onData([]);
    return () => {};
  }
  const db = getFirestoreDb();
  const q = query(collection(db, `chat_users/${myUserId}/contacts`), limit(100));

  const unsub = onSnapshot(q, (snap) => {
    const contatos: ChatContact[] = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        username: String(data.username || d.id),
        displayName: String(data.displayName || data.username || "Contato"),
        isAdmin: Boolean(data.isAdmin),
        cargo: data.cargo ? String(data.cargo) : (data.isAdmin ? "admin" : "operador"),
        photoUrl: data.photoUrl ? String(data.photoUrl) : undefined,
        recado: data.recado ? String(data.recado) : undefined,
        statusPreset: data.statusPreset ? String(data.statusPreset) : undefined,
      };
    });
    onData(contatos);
  }, (err) => {
    console.log("[ChatRepo] Erro ao ouvir contatos:", err);
  });

  return unsub;
}

export async function removerContatoUsuario(myUserId: string, contatoId: string): Promise<void> {
  if (!myUserId || !contatoId) return;
  const db = getFirestoreDb();
  const contactRef = doc(db, `chat_users/${myUserId}/contacts/${contatoId}`);
  await deleteDoc(contactRef);
}

export async function limparUsuarioAntigo(userIdOrTag: string): Promise<void> {
  if (!userIdOrTag) return;
  const clean = userIdOrTag.toLowerCase().replace(/^@/, "").trim();
  const db = getFirestoreDb();
  try {
    await deleteDoc(doc(db, `chat_users/${clean}`));
  } catch (e) {
    console.log("[ChatRepo] Erro ao limpar usuário antigo:", e);
  }
}
