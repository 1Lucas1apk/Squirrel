import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  criarLoja,
  entrarNaLoja,
  sairDaLoja as sairDaLojaRepo,
  buscarFechamentosPOSDoDia,
  ouvirFechamentosPOSDoDia,
  registrarFechamentoPOS,
  removerFechamentoPOS as removerFechamentoPOSRepo,
  limparFechamentosPOSDoDia,
  FechamentoPOS
} from '../services/repositories/loja-repository';
import { getFirebaseAuth } from '../services/firebase/client';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { getFirestoreDb } from '../services/firebase/client';

const LOJA_KEY = '@squirrel_loja_codigo';
const NOME_KEY = '@squirrel_loja_nome';

export interface MembroLoja {
  uid: string;
  nome: string;
  entrouEm: number;
}

export function useLoja() {
  const [lojaCodigo, setLojaCodigo] = useState<string | null>(null);
  const [lojaNome, setLojaNome] = useState<string | null>(null);
  const [membros, setMembros] = useState<MembroLoja[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLoja() {
      try {
        const codigo = await AsyncStorage.getItem(LOJA_KEY);
        const nome = await AsyncStorage.getItem(NOME_KEY);
        if (codigo) {
          setLojaCodigo(codigo);
          setLojaNome(nome || "Minha Loja");
        }
      } catch (e) {
        console.error("Erro ao carregar loja local", e);
      } finally {
        setLoading(false);
      }
    }
    loadLoja();
  }, []);

  useEffect(() => {
    if (!lojaCodigo) {
      setMembros([]);
      return;
    }

    const db = getFirestoreDb();
    const unsub = onSnapshot(collection(db, `lojas/${lojaCodigo}/membros`), (snap) => {
      const ms: MembroLoja[] = [];
      snap.forEach(d => {
        ms.push({
          uid: d.id,
          nome: d.data().nome || "Operador",
          entrouEm: d.data().entrou_em || 0
        });
      });
      setMembros(ms);
    }, (err) => {
      console.warn("Erro ao ouvir membros da loja", err);
    });

    return () => unsub();
  }, [lojaCodigo]);

  async function handleCriarLoja(codigo: string, nome: string) {
    await criarLoja(codigo, nome);
    await AsyncStorage.setItem(LOJA_KEY, codigo.toUpperCase());
    await AsyncStorage.setItem(NOME_KEY, nome);
    setLojaCodigo(codigo.toUpperCase());
    setLojaNome(nome);
  }

  async function handleEntrarLoja(codigo: string, nomeOperador: string) {
    const { nome } = await entrarNaLoja(codigo, nomeOperador);
    await AsyncStorage.setItem(LOJA_KEY, codigo.toUpperCase());
    await AsyncStorage.setItem(NOME_KEY, nome);
    setLojaCodigo(codigo.toUpperCase());
    setLojaNome(nome);
  }

  async function handleSairLoja() {
    if (lojaCodigo) {
      await sairDaLojaRepo(lojaCodigo);
    }
    await AsyncStorage.removeItem(LOJA_KEY);
    await AsyncStorage.removeItem(NOME_KEY);
    setLojaCodigo(null);
    setLojaNome(null);
    setMembros([]);
  }

  async function fetchFechamentosPOS(dataReferencia: string, meuTurnoId: string): Promise<FechamentoPOS[]> {
    if (!lojaCodigo) return [];
    return buscarFechamentosPOSDoDia(lojaCodigo, dataReferencia, meuTurnoId);
  }

  function ouvirFechamentosPOS(dataReferencia: string, meuTurnoId: string, meuCriadoEm: number, callback: (f: FechamentoPOS[]) => void): () => void {
    if (!lojaCodigo) return () => { };
    return ouvirFechamentosPOSDoDia(lojaCodigo, dataReferencia, meuTurnoId, meuCriadoEm, callback);
  }

  async function registrarRelatorioPOS(dataReferencia: string, turnoId: string, turnoCriadoEm: number, valorTotal: number) {
    if (!lojaCodigo) return;
    const uid = getFirebaseAuth().currentUser?.uid;
    const meuMembro = membros.find(m => m.uid === uid);
    const operador = meuMembro ? meuMembro.nome : "Operador";
    await registrarFechamentoPOS(lojaCodigo, dataReferencia, turnoId, turnoCriadoEm, valorTotal, operador);
  }

  async function removerFechamentoPOSDeTurno(dataReferencia: string, turnoId: string) {
    if (!lojaCodigo) return;
    await removerFechamentoPOSRepo(lojaCodigo, dataReferencia, turnoId);
  }

  async function limparFechamentosDoDia(dataReferencia: string) {
    if (!lojaCodigo) return;
    await limparFechamentosPOSDoDia(lojaCodigo, dataReferencia);
  }

  return {
    lojaCodigo,
    lojaNome,
    membros,
    loading,
    criarLoja: handleCriarLoja,
    entrarNaLoja: handleEntrarLoja,
    sairDaLoja: handleSairLoja,
    buscarFechamentosPOS: fetchFechamentosPOS,
    ouvirFechamentosPOS,
    registrarFechamentoPOS: registrarRelatorioPOS,
    removerFechamentoPOS: removerFechamentoPOSDeTurno,
    limparFechamentosDoDia
  };
}
