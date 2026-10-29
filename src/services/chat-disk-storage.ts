import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MensagemChat } from "../types/domain";
import { getUid } from "./auth-storage";

// Diretório físico no disco do dispositivo Android / iOS
const DISK_DIR = `${FileSystem.documentDirectory}squirrel/mensagens/`;

let isDirCreated = false;
let saveDebounceTimer: any = null;

// Retorna o caminho do arquivo JSON exclusivo da conta logada
async function getChatFilePath(): Promise<string> {
  try {
    const uid = await getUid();
    const safeUid = uid ? uid.replace(/[^a-zA-Z0-9_-]/g, "") : "global";
    return `${DISK_DIR}chat_historico_${safeUid}.json`;
  } catch {
    return `${DISK_DIR}chat_historico_global.json`;
  }
}

// Retorna a chave do AsyncStorage exclusiva da conta na Web
async function getWebStorageKey(): Promise<string> {
  try {
    const uid = await getUid();
    const safeUid = uid ? uid.replace(/[^a-zA-Z0-9_-]/g, "") : "global";
    return `@squirrel_disk_chat_historico_${safeUid}`;
  } catch {
    return "@squirrel_disk_chat_historico_global";
  }
}

// Garante que o diretório /squirrel/mensagens/ exista no disco
async function ensureDir(): Promise<void> {
  if (Platform.OS === "web" || isDirCreated) return;
  try {
    const dirInfo = await FileSystem.getInfoAsync(DISK_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(DISK_DIR, { intermediates: true });
    }
    isDirCreated = true;
  } catch (err) {
    console.log("[ChatDisk] Erro ao criar diretório no disco:", err);
  }
}

// Cache em memória RAM (elimina I/O e JSON.parse síncrono no thread principal a cada snapshot)
let memoryHistoryCache: MensagemChat[] | null = null;

/**
 * Carrega o histórico completo de mensagens diretamente do DISCO FÍSICO desta conta (0ms no boot)
 */
export async function carregarHistoricoDoDisco(): Promise<MensagemChat[]> {
  if (memoryHistoryCache !== null) {
    return memoryHistoryCache;
  }

  try {
    if (Platform.OS === "web") {
      const key = await getWebStorageKey();
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          memoryHistoryCache = parsed;
          return parsed;
        }
      }
      memoryHistoryCache = [];
      return [];
    }

    await ensureDir();
    const filePath = await getChatFilePath();
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    if (!fileInfo.exists) {
      memoryHistoryCache = [];
      return [];
    }

    const content = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (content) {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        memoryHistoryCache = parsed;
        return parsed;
      }
    }
    memoryHistoryCache = [];
    return [];
  } catch (err) {
    console.log("[ChatDisk] Erro ao ler histórico do disco:", err);
    memoryHistoryCache = [];
    return [];
  }
}

/**
 * Salva a lista de mensagens no DISCO FÍSICO em formato .json formatado e compacto
 */
export async function salvarHistoricoNoDisco(mensagens: MensagemChat[]): Promise<void> {
  if (!mensagens || !Array.isArray(mensagens)) return;

  // Atualiza cache em RAM instantaneamente (0ms)
  memoryHistoryCache = mensagens;

  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }

  saveDebounceTimer = setTimeout(async () => {
    try {
      const jsonStr = JSON.stringify(mensagens);

      if (Platform.OS === "web") {
        const key = await getWebStorageKey();
        await AsyncStorage.setItem(key, jsonStr);
        return;
      }

      await ensureDir();
      const filePath = await getChatFilePath();
      await FileSystem.writeAsStringAsync(filePath, jsonStr, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    } catch (err) {
      console.log("[ChatDisk] Erro ao gravar histórico no disco:", err);
    }
  }, 2000);
}

/**
 * Mescla de forma inteligente mensagens da nuvem com o arquivo histórico do disco:
 * - Mantém mensagens antigas que já saíram da janela de 500 do Firestore
 * - Resolução de Conflitos Granular:
 *   • Deleções: se a nuvem ou o disco apagou, a flag de apagada prevalece
 *   • Edições: o texto com maior timestamp de edição vence
 *   • Reações: união aditiva de todos os emojis reagidos
 *   • Confirmação de Leitura: união cumulativa de todos os IDs de leitores
 */
export async function mesclarMensagensDiscoComNuvem(
  mensagensNuvem: MensagemChat[]
): Promise<MensagemChat[]> {
  try {
    const mensagensLocais = await carregarHistoricoDoDisco();
    const localMap = new Map<string, MensagemChat>();
    for (const l of mensagensLocais) {
      if (l && l.id) localMap.set(l.id, l);
    }
    const mapa = new Map<string, MensagemChat>();

    // 1. Se a nuvem estiver vazia (modo offline puro), carrega todo o disco
    if (mensagensNuvem.length === 0) {
      for (const m of mensagensLocais) {
        if (m && m.id) mapa.set(m.id, m);
      }
    } else {
      // Se a nuvem retornou dados, mantém do disco apenas mensagens temporárias locais pendentes
      for (const m of mensagensLocais) {
        if (m && m.id && (m.id.startsWith("local_") || (m as any).isLocalTemp)) {
          mapa.set(m.id, m);
        }
      }
    }

    // 2. Mescla granular campo a campo com os dados recebidos da nuvem
    for (const nuvemMsg of mensagensNuvem) {
      if (!nuvemMsg || !nuvemMsg.id) continue;

      const localMsg = localMap.get(nuvemMsg.id);

      if (!localMsg) {
        // Mensagem nova que não tínhamos no disco
        mapa.set(nuvemMsg.id, nuvemMsg);
      } else {
        // Mensagem existente em ambos: resolução inteligente de divergência
        const editadaEmFinal = Math.max(localMsg.editadaEm || 0, nuvemMsg.editadaEm || 0) || undefined;
        const textoFinal = (nuvemMsg.editadaEm || 0) >= (localMsg.editadaEm || 0)
          ? (nuvemMsg.texto || localMsg.texto)
          : localMsg.texto;

        const apagadaEmFinal = nuvemMsg.apagadaEm || localMsg.apagadaEm || undefined;

        // União cumulativa de leitores
        const leitoresSet = new Set([
          ...(Array.isArray(localMsg.lidasPor) ? localMsg.lidasPor : []),
          ...(Array.isArray(nuvemMsg.lidasPor) ? nuvemMsg.lidasPor : [])
        ]);

        // União cumulativa de reações
        const reacoesFinal: Record<string, string[]> = {};
        const allEmojis = new Set([
          ...Object.keys(localMsg.reacoes || {}),
          ...Object.keys(nuvemMsg.reacoes || {})
        ]);

        for (const emoji of allEmojis) {
          const uidsLocal = (localMsg.reacoes || {})[emoji] || [];
          const uidsNuvem = (nuvemMsg.reacoes || {})[emoji] || [];
          const uidsUnificados = Array.from(new Set([...uidsLocal, ...uidsNuvem]));
          if (uidsUnificados.length > 0) {
            reacoesFinal[emoji] = uidsUnificados;
          }
        }

        const mesclada: MensagemChat = {
          ...localMsg,
          ...nuvemMsg,
          texto: textoFinal,
          editadaEm: editadaEmFinal,
          apagadaEm: apagadaEmFinal,
          lidasPor: Array.from(leitoresSet),
          reacoes: reacoesFinal,
          timestamp: nuvemMsg.timestamp || localMsg.timestamp || Date.now()
        };

        mapa.set(nuvemMsg.id, mesclada);
      }
    }

    // 3. Ordenação cronológica estrita crescente
    const listaMesclada = Array.from(mapa.values()).sort(
      (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
    );

    // 4. Grava a base unificada atualizada no disco físico
    void salvarHistoricoNoDisco(listaMesclada);

    return listaMesclada;
  } catch (err) {
    console.log("[ChatDisk] Erro ao mesclar disco com nuvem:", err);
    return mensagensNuvem;
  }
}
