import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot,
  query,
  orderBy,
  limit,
  updateDoc,
  arrayUnion,
  deleteDoc
} from "firebase/firestore";
import { ref, onDisconnect, set, onValue, serverTimestamp, remove } from "firebase/database";
import { getFirestoreDb, getFirebaseApp } from "../firebase/client";
import { getRealtimeDatabase } from "../firebase/realtime";
import { MensagemChat } from "../../types/domain";
import { Unsubscribe } from "firebase/auth";

function mapMensagem(id: string, data: any): MensagemChat {
  return {
    id,
    remetenteId: String(data.remetenteId || ""),
    remetenteNome: String(data.remetenteNome || "Desconhecido"),
    destinatarioId: data.destinatarioId || undefined,
    texto: String(data.texto || ""),
    timestamp: Number(data.timestamp || 0),
    lidasPor: Array.isArray(data.lidasPor) ? data.lidasPor : [],
    editadaEm: data.editadaEm ? Number(data.editadaEm) : undefined,
    apagadaEm: data.apagadaEm ? Number(data.apagadaEm) : undefined,
  };
}

export async function apagarMensagemChat(mensagemId: string, pairingCode: string): Promise<void> {
  if (!mensagemId || !pairingCode) return;
  const db = getFirestoreDb();
  const msgRef = doc(db, `chats/${pairingCode}/mensagens/${mensagemId}`);
  await updateDoc(msgRef, {
    apagadaEm: Date.now()
  });
}

export async function editarMensagemChat(mensagemId: string, novoTexto: string, pairingCode: string): Promise<void> {
  if (!mensagemId || !novoTexto || !pairingCode) return;
  const db = getFirestoreDb();
  const msgRef = doc(db, `chats/${pairingCode}/mensagens/${mensagemId}`);
  await updateDoc(msgRef, {
    texto: novoTexto,
    editadaEm: Date.now()
  });
}

export async function enviarMensagemChat(
  mensagem: Omit<MensagemChat, "id" | "timestamp" | "lidasPor">,
  pairingCode: string
): Promise<string> {
  if (!pairingCode) throw new Error("Código de pareamento não configurado.");
  const db = getFirestoreDb();
  
  const msgRef = doc(collection(db, `chats/${pairingCode}/mensagens`));
  const payload: any = {
    ...mensagem,
    timestamp: Date.now(),
    lidasPor: [mensagem.remetenteId],
  };

  if (payload.destinatarioId === undefined) {
    delete payload.destinatarioId;
  }

  await setDoc(msgRef, payload);
  return msgRef.id;
}

export function ouvirMensagensChat(pairingCode: string, onData: (mensagens: MensagemChat[]) => void): Unsubscribe {
  if (!pairingCode) {
    onData([]);
    return () => {};
  }
  
  const db = getFirestoreDb();
  const q = query(
    collection(db, `chats/${pairingCode}/mensagens`),
    orderBy("timestamp", "desc"),
    limit(500)
  );

  const unsub = onSnapshot(q, (snap) => {
    const arr = snap.docs.map(d => mapMensagem(d.id, d.data()));
    onData(arr.reverse());
  });

  return unsub;
}

export async function registrarCaixaEOnline(caixaId: string, nome: string, pairingCode: string): Promise<void> {
  if (!caixaId || !pairingCode) return;
  
  // 1. Salva o contato para sempre no Firestore
  const db = getFirestoreDb();
  await setDoc(doc(db, `chats/${pairingCode}/caixas/${caixaId}`), {
    id: caixaId,
    nome: nome,
    atualizadoEm: Date.now()
  }, { merge: true });

  // 2. Presença no RTDB
  const rtdb = getRealtimeDatabase();
  const presenceRef = ref(rtdb, `presence/${pairingCode}/${caixaId}`);
  
  await onDisconnect(presenceRef).remove();
  
  await set(presenceRef, {
    online: true,
    nome: nome,
    lastSeen: serverTimestamp()
  });
}

export function ouvirContatos(pairingCode: string, onData: (contatos: {id: string, nome: string}[]) => void): Unsubscribe {
  if (!pairingCode) {
    onData([]);
    return () => {};
  }
  
  const db = getFirestoreDb();
  const q = query(collection(db, `chats/${pairingCode}/caixas`));
  
  const unsub = onSnapshot(q, (snap) => {
    const contatos = snap.docs.map(d => ({
      id: d.id,
      nome: d.data().nome || d.id
    }));
    onData(contatos);
  });

  return unsub;
}

export function ouvirPresenca(pairingCode: string, onData: (onlineCaixas: {id: string, nome: string}[]) => void): Unsubscribe {
  if (!pairingCode) {
    onData([]);
    return () => {};
  }
  
  const rtdb = getRealtimeDatabase();
  const presenceRef = ref(rtdb, `presence/${pairingCode}`);
  
  const unsub = onValue(presenceRef, (snap) => {
    const val = snap.val();
    if (!val) {
      onData([]);
      return;
    }
    const online = Object.keys(val)
      .filter(k => val[k]?.online === true)
      .map(k => ({
        id: k,
        nome: val[k]?.nome || k
      }));
    onData(online);
  });

  return () => unsub();
}

export async function removerPresencaMorta(pairingCode: string, idMorta: string): Promise<void> {
  if (!pairingCode || !idMorta) return;
  
  // Remove from RTDB (Online presence)
  const rtdb = getRealtimeDatabase();
  const presenceRef = ref(rtdb, `presence/${pairingCode}/${idMorta}`);
  await remove(presenceRef);

  // Remove from Firestore (Offline contacts list)
  const db = getFirestoreDb();
  const docRef = doc(db, `chats/${pairingCode}/caixas/${idMorta}`);
  await deleteDoc(docRef);
}

export async function marcarMensagemComoLida(mensagemId: string, caixaIdQueLeu: string, pairingCode: string): Promise<void> {
  if (!caixaIdQueLeu || !mensagemId || !pairingCode) return;
  const db = getFirestoreDb();
  
  const msgRef = doc(db, `chats/${pairingCode}/mensagens/${mensagemId}`);
  await updateDoc(msgRef, {
    lidasPor: arrayUnion(caixaIdQueLeu)
  });
}
