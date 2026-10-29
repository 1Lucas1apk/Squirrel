import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirestoreDb } from "../firebase/client";
import palavrasBase from "../../data/palavras-termo.json";

// Set de palavras secretas (1.600 palavras reais mais comuns do português brasileiro)
const segredosSet = new Set<string>(palavrasBase.segredos);

// Set de todas as palavras válidas para chute (9.979 palavras do LibreOffice / pythonprobr)
const dicionarioCompletoSet = new Set<string>(palavrasBase.dicionario);

// Palavras adicionais sincronizadas do Firestore em tempo de execução
let cloudWordsLoaded = false;
const cloudSegredos = new Set<string>();

/**
 * Normaliza qualquer string para o padrão do Termo:
 * Remove acentos, caracteres especiais e transforma em maiúsculas
 */
export function normalizarTermoWord(p: string): string {
  if (!p) return "";
  return p
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .trim();
}

/**
 * Sincroniza palavras extras salvas no Firestore (Banco de Dados em Nuvem)
 */
export async function sincronizarPalavrasFirestore(): Promise<void> {
  if (cloudWordsLoaded) return;
  try {
    const db = getFirestoreDb();
    const docRef = doc(db, "game_config/termo_words");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const custom: string[] = data?.palavras || [];
      custom.forEach(w => {
        const norm = normalizarTermoWord(w);
        if (norm.length === 5) {
          cloudSegredos.add(norm);
          dicionarioCompletoSet.add(norm);
        }
      });
    }
    cloudWordsLoaded = true;
  } catch {
    // Modo offline resiliente: continua com o banco local de 10.000 palavras
  }
}

/**
 * Sorteia uma palavra secreta para a partida.
 * Utiliza o banco de dados filtrado das palavras mais comuns e conhecidas do português.
 */
export function sortearPalavraTermo(): string {
  // Dispara sincronização em segundo plano se ainda não sincronizou
  if (!cloudWordsLoaded) {
    void sincronizarPalavrasFirestore();
  }

  const pool = Array.from(new Set([...palavrasBase.segredos, ...Array.from(cloudSegredos)]));
  if (pool.length === 0) return "TERMO";

  const idx = Math.floor(Math.random() * pool.length);
  return normalizarTermoWord(pool[idx]);
}

/**
 * Valida se um palpite é uma palavra existente no dicionário oficial de português.
 */
export function isPalavraValidaDicionario(palpite: string): boolean {
  const norm = normalizarTermoWord(palpite);
  if (norm.length !== 5) return false;
  return dicionarioCompletoSet.has(norm) || segredosSet.has(norm);
}

/**
 * Permite adicionar uma nova palavra de 5 letras ao Banco de Dados Firestore
 */
export async function adicionarPalavraAoBanco(palavra: string): Promise<boolean> {
  const norm = normalizarTermoWord(palavra);
  if (norm.length !== 5) return false;

  cloudSegredos.add(norm);
  dicionarioCompletoSet.add(norm);

  try {
    const db = getFirestoreDb();
    const docRef = doc(db, "game_config/termo_words");
    const snap = await getDoc(docRef);
    const atuais: string[] = snap.exists() ? (snap.data()?.palavras || []) : [];
    if (!atuais.includes(norm)) {
      await setDoc(docRef, {
        palavras: [...atuais, norm],
        atualizadoEm: Date.now()
      }, { merge: true });
    }
    return true;
  } catch {
    return false;
  }
}
