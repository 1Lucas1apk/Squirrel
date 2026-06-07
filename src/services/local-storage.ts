import { Platform } from 'react-native';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createMMKV } from 'react-native-mmkv';
import { Turno, Transacao, LembreteFantasma, LogAlteracao } from "../types/domain";

// Instância nativa do MMKV (inativa na Web)
const isWeb = Platform.OS === 'web';
const storage = isWeb ? null : createMMKV({ id: 'squirrel-storage' });

const KEYS = {
  CURRENT_TURNO: "@squirrel_cache_turno",
  CURRENT_TRANSACOES: "@squirrel_cache_transacoes",
  CURRENT_FANTASMAS: "@squirrel_cache_fantasmas",
  CURRENT_LOGS: "@squirrel_cache_logs",
  OFFLINE_QUEUE: "@squirrel_offline_queue",
};

export async function saveCurrentShiftCache(
  turno: Turno | null,
  transacoes: Transacao[],
  fantasmas: LembreteFantasma[],
  logs: LogAlteracao[] = []
) {
  try {
    const dataTransacoes = JSON.stringify(transacoes);
    const dataFantasmas = JSON.stringify(fantasmas);
    const dataLogs = JSON.stringify(logs);
    const dataTurno = turno ? JSON.stringify(turno) : null;

    if (isWeb) {
      await Promise.all([
        AsyncStorage.setItem(KEYS.CURRENT_TRANSACOES, dataTransacoes),
        AsyncStorage.setItem(KEYS.CURRENT_FANTASMAS, dataFantasmas),
        AsyncStorage.setItem(KEYS.CURRENT_LOGS, dataLogs),
        dataTurno 
          ? AsyncStorage.setItem(KEYS.CURRENT_TURNO, dataTurno) 
          : AsyncStorage.removeItem(KEYS.CURRENT_TURNO),
      ]);
    } else {
      // MMKV: Síncrono e ultra rápido
      storage!.set(KEYS.CURRENT_TRANSACOES, dataTransacoes);
      storage!.set(KEYS.CURRENT_FANTASMAS, dataFantasmas);
      storage!.set(KEYS.CURRENT_LOGS, dataLogs);
      if (dataTurno) {
        storage!.set(KEYS.CURRENT_TURNO, dataTurno);
      } else {
        storage!.remove(KEYS.CURRENT_TURNO);
      }
    }
  } catch (e) {
    console.error("Erro ao salvar cache local", e);
  }
}

export async function loadCurrentShiftCache() {
  try {
    let turnoRaw, transacoesRaw, fantasmasRaw, logsRaw;

    if (isWeb) {
      [turnoRaw, transacoesRaw, fantasmasRaw, logsRaw] = await Promise.all([
        AsyncStorage.getItem(KEYS.CURRENT_TURNO),
        AsyncStorage.getItem(KEYS.CURRENT_TRANSACOES),
        AsyncStorage.getItem(KEYS.CURRENT_FANTASMAS),
        AsyncStorage.getItem(KEYS.CURRENT_LOGS),
      ]);
    } else {
      turnoRaw = storage!.getString(KEYS.CURRENT_TURNO);
      transacoesRaw = storage!.getString(KEYS.CURRENT_TRANSACOES);
      fantasmasRaw = storage!.getString(KEYS.CURRENT_FANTASMAS);
      logsRaw = storage!.getString(KEYS.CURRENT_LOGS);
    }

    return {
      turno: turnoRaw ? (JSON.parse(turnoRaw) as Turno) : null,
      transacoes: transacoesRaw ? (JSON.parse(transacoesRaw) as Transacao[]) : [],
      fantasmas: fantasmasRaw ? (JSON.parse(fantasmasRaw) as LembreteFantasma[]) : [],
      logs: logsRaw ? (JSON.parse(logsRaw) as LogAlteracao[]) : [],
    };
  } catch (e) {
    console.error("Erro ao carregar cache local", e);
    return { turno: null, transacoes: [], fantasmas: [], logs: [] };
  }
}

export async function clearCurrentShiftCache() {
  if (isWeb) {
    await Promise.all([
      AsyncStorage.removeItem(KEYS.CURRENT_TURNO),
      AsyncStorage.removeItem(KEYS.CURRENT_TRANSACOES),
      AsyncStorage.removeItem(KEYS.CURRENT_FANTASMAS),
      AsyncStorage.removeItem(KEYS.CURRENT_LOGS),
    ]);
  } else {
    storage!.remove(KEYS.CURRENT_TURNO);
    storage!.remove(KEYS.CURRENT_TRANSACOES);
    storage!.remove(KEYS.CURRENT_FANTASMAS);
    storage!.remove(KEYS.CURRENT_LOGS);
  }
}

export interface QueuedAction {
  id: string;
  type: "ADD_TRANSACAO" | "EDIT_TRANSACAO" | "REMOVE_TRANSACAO" | "ADD_FANTASMA" | "EDIT_FANTASMA" | "REMOVE_FANTASMA" | "UPDATE_TURNO_STATUS" | "SAVE_TOTAIS" | "ADD_LOG";
  payload: any;
  timestamp: number;
  attempts?: number;
  nextRetryAt?: number;
  lastError?: string;
}

export async function getOfflineQueue(): Promise<QueuedAction[]> {
  try {
    const raw = isWeb 
      ? await AsyncStorage.getItem(KEYS.OFFLINE_QUEUE)
      : storage!.getString(KEYS.OFFLINE_QUEUE);
      
    const parsed = raw ? (JSON.parse(raw) as QueuedAction[]) : [];
    return parsed.map((item) => ({
      ...item,
      attempts: item.attempts ?? 0,
      nextRetryAt: item.nextRetryAt ?? 0,
    }));
  } catch (e) {
    return [];
  }
}

export async function saveOfflineQueue(queue: QueuedAction[]) {
  try {
    const data = JSON.stringify(queue);
    if (isWeb) {
      await AsyncStorage.setItem(KEYS.OFFLINE_QUEUE, data);
    } else {
      storage!.set(KEYS.OFFLINE_QUEUE, data);
    }
  } catch (e) {
    console.error("Erro ao salvar fila offline", e);
  }
}
