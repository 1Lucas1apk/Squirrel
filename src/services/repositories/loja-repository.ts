import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { getFirestoreDb, getFirebaseAuth } from "../firebase/client";

export interface FechamentoPOS {
  id: string;
  uid: string;
  operador: string;
  valorTotal: number;
  timestamp: number;
}

export async function criarLoja(codigo: string, nome: string): Promise<void> {
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
    nome: "Operador",
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

export async function buscarFechamentosPOSDoDia(codigo: string, dataReferencia: string): Promise<FechamentoPOS[]> {
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
    if (data.uid !== uid) { // Não pega o meu próprio fechamento
      fechamentos.push({
        id: doc.id,
        uid: data.uid,
        operador: data.operador || "Outro Caixa",
        valorTotal: data.valor_total || 0,
        timestamp: data.timestamp || 0
      });
    }
  });

  return fechamentos.sort((a, b) => b.timestamp - a.timestamp);
}

export async function registrarFechamentoPOS(codigo: string, dataReferencia: string, valorTotal: number, operador: string = "Operador"): Promise<void> {
  const auth = getFirebaseAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const db = getFirestoreDb();
  const lojaCode = codigo.toUpperCase().trim();
  
  const fechamentoRef = doc(db, `lojas/${lojaCode}/pos_fechamentos`, `${dataReferencia}_${uid}`);
  
  await setDoc(fechamentoRef, {
    data_referencia: dataReferencia,
    uid,
    operador,
    valor_total: valorTotal,
    timestamp: Date.now()
  });
}
