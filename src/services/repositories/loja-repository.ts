import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { getFirestoreDb, getFirebaseAuth } from "../firebase/client";

export interface FechamentoPOS {
  id: string;
  turnoId: string;
  uid: string;
  operador: string;
  valorTotal: number;
  timestamp: number;
  turnoCriadoEm?: number; // criado no turno do operador que registrou este fechamento
}

export async function criarLoja(codigo: string, nome: string, nomeOperador: string = "Operador"): Promise<void> {
  const auth = getFirebaseAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Usuário não autenticado");

  const db = getFirestoreDb();
  const lojaCode = codigo.toUpperCase().trim();
  const lojaRef = doc(db, "lojas", lojaCode);

  const snap = await getDoc(lojaRef);
  if (snap.exists()) {
    throw new Error("Já existe uma loja com este código.");
  }

  await setDoc(lojaRef, {
    nome,
    criado_em: Date.now(),
    criado_por: uid,
  });

  const membroRef = doc(db, `lojas/${lojaCode}/membros`, uid);
  await setDoc(membroRef, {
    nome: nomeOperador,
    entrou_em: Date.now()
  });
}

export async function entrarNaLoja(codigo: string, nomeOperador: string = "Operador"): Promise<{ nome: string }> {
  const auth = getFirebaseAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Usuário não autenticado");

  const db = getFirestoreDb();
  const lojaCode = codigo.toUpperCase().trim();
  const lojaRef = doc(db, "lojas", lojaCode);

  const snap = await getDoc(lojaRef);
  if (!snap.exists()) {
    throw new Error("Loja não encontrada com este código.");
  }

  const membroRef = doc(db, `lojas/${lojaCode}/membros`, uid);
  await setDoc(membroRef, {
    nome: nomeOperador,
    entrou_em: Date.now()
  });

  return { nome: snap.data().nome };
}

export async function sairDaLoja(codigo: string): Promise<void> {
  const auth = getFirebaseAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const db = getFirestoreDb();
  const lojaCode = codigo.toUpperCase().trim();
  const membroRef = doc(db, `lojas/${lojaCode}/membros`, uid);
  await deleteDoc(membroRef);
}

export async function buscarFechamentosPOSDoDia(codigo: string, dataReferencia: string, meuTurnoId: string): Promise<FechamentoPOS[]> {
  const auth = getFirebaseAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) return [];

  const db = getFirestoreDb();
  const lojaCode = codigo.toUpperCase().trim();

  const q = query(
    collection(db, `lojas/${lojaCode}/pos_fechamentos`),
    where("data_referencia", "==", dataReferencia)
  );

  const snap = await getDocs(q);
  const fechamentos: FechamentoPOS[] = [];

  snap.forEach(doc => {
    const data = doc.data();
    if (data.turnoId !== meuTurnoId) { // Não pega o meu próprio turno
      fechamentos.push({
        id: doc.id,
        turnoId: data.turnoId,
        uid: data.uid,
        operador: data.operador || "Outro Caixa",
        valorTotal: data.valor_total || 0,
        timestamp: data.timestamp || 0,
        turnoCriadoEm: data.turnoCriadoEm || 0
      });
    }
  });

  return fechamentos.sort((a, b) => b.timestamp - a.timestamp);
}

export async function registrarFechamentoPOS(codigo: string, dataReferencia: string, turnoId: string, turnoCriadoEm: number, valorTotal: number, operador: string = "Operador"): Promise<void> {
  const auth = getFirebaseAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const db = getFirestoreDb();
  const lojaCode = codigo.toUpperCase().trim();

  const fechamentoRef = doc(db, `lojas/${lojaCode}/pos_fechamentos`, `${dataReferencia}_${turnoId}`);

  await setDoc(fechamentoRef, {
    data_referencia: dataReferencia,
    turnoId,
    turnoCriadoEm,
    uid,
    operador,
    valor_total: valorTotal,
    timestamp: Date.now()
  });
}

/**
 * Remove o fechamento POS da loja quando um turno é excluído.
 * Isso evita dados órfãos que causam descontos incorretos em turnos futuros.
 */
export async function removerFechamentoPOS(codigo: string, dataReferencia: string, turnoId: string): Promise<void> {
  const db = getFirestoreDb();
  const lojaCode = codigo.toUpperCase().trim();
  const fechamentoRef = doc(db, `lojas/${lojaCode}/pos_fechamentos`, `${dataReferencia}_${turnoId}`);
  await deleteDoc(fechamentoRef);
}

/**
 * Remove TODOS os fechamentos POS de um dia inteiro para uma loja.
 * Útil para limpar dados de teste ou resetar o dia.
 */
export async function limparFechamentosPOSDoDia(codigo: string, dataReferencia: string): Promise<void> {
  const db = getFirestoreDb();
  const lojaCode = codigo.toUpperCase().trim();

  const q = query(
    collection(db, `lojas/${lojaCode}/pos_fechamentos`),
    where("data_referencia", "==", dataReferencia)
  );

  const snap = await getDocs(q);
  const promises: Promise<void>[] = [];
  snap.forEach(d => {
    promises.push(deleteDoc(doc(db, `lojas/${lojaCode}/pos_fechamentos`, d.id)));
  });
  await Promise.all(promises);
}

export function ouvirFechamentosPOSDoDia(codigo: string, dataReferencia: string, meuTurnoId: string, meuCriadoEm: number, callback: (fechamentos: FechamentoPOS[]) => void): () => void {
  const auth = getFirebaseAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) {
    callback([]);
    return () => { };
  }

  const db = getFirestoreDb();
  const lojaCode = codigo.toUpperCase().trim();

  const q = query(
    collection(db, `lojas/${lojaCode}/pos_fechamentos`),
    where("data_referencia", "==", dataReferencia)
  );

  return onSnapshot(q, (snap: import("firebase/firestore").QuerySnapshot) => {
    const fechamentos: FechamentoPOS[] = [];
    snap.forEach((doc: import("firebase/firestore").QueryDocumentSnapshot) => {
      const data = doc.data();
      // Somente abater turnos que foram CRIADOS estritamente antes do turno atual ter sido CRIADO
      // (Se turnoCriadoEm não existir em dados antigos, assume 0 para sempre abater)
      const outroTurnoCriadoEm = data.turnoCriadoEm || 0;
      if (data.turnoId !== meuTurnoId && outroTurnoCriadoEm < meuCriadoEm) {
        fechamentos.push({
          id: doc.id,
          turnoId: data.turnoId,
          uid: data.uid,
          operador: data.operador || "Outro Caixa",
          valorTotal: data.valor_total || 0,
          timestamp: data.timestamp || 0,
          turnoCriadoEm: outroTurnoCriadoEm
        });
      }
    });
    callback(fechamentos.sort((a, b) => b.timestamp - a.timestamp));
  });
}
