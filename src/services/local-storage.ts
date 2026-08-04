import { Platform } from 'react-native';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createMMKV } from 'react-native-mmkv';
import { Turno, Transacao, LembreteFantasma, LogAlteracao, RegistroPOS, RegistroConvenio } from "../types/domain";

// Instância nativa do MMKV (inativa na Web)
const isWeb = Platform.OS === 'web';
const storage = isWeb ? null : createMMKV({ id: 'squirrel-storage' });

const KEYS = {
  CURRENT_TURNO: "@squirrel_cache_turno",
  CURRENT_TRANSACOES: "@squirrel_cache_transacoes",
  CURRENT_FANTASMAS: "@squirrel_cache_fantasmas",
  CURRENT_LOGS: "@squirrel_cache_logs",
  CURRENT_POS: "@squirrel_cache_pos",
  CURRENT_CONVENIO: "@squirrel_cache_convenio",
  OFFLINE_QUEUE: "@squirrel_offline_queue",
  SNAPSHOTS_INDEX: "@squirrel_snapshots_index",
};

const MAX_SNAPSHOTS = 60;

export async function saveCurrentShiftCache(
  turno: Turno | null,
  transacoes: Transacao[],
  fantasmas: LembreteFantasma[],
  logs: LogAlteracao[] = [],
  registrosPOS: RegistroPOS[] = [],
  registrosConvenio: RegistroConvenio[] = []
) {
  try {
    const dataTransacoes = JSON.stringify(transacoes);
    const dataFantasmas = JSON.stringify(fantasmas);
    const dataLogs = JSON.stringify(logs);
    const dataTurno = turno ? JSON.stringify(turno) : null;
    const dataPOS = JSON.stringify(registrosPOS);
    const dataConvenio = JSON.stringify(registrosConvenio);

    if (isWeb) {
      await Promise.all([
        AsyncStorage.setItem(KEYS.CURRENT_TRANSACOES, dataTransacoes),
        AsyncStorage.setItem(KEYS.CURRENT_FANTASMAS, dataFantasmas),
        AsyncStorage.setItem(KEYS.CURRENT_LOGS, dataLogs),
        AsyncStorage.setItem(KEYS.CURRENT_POS, dataPOS),
        AsyncStorage.setItem(KEYS.CURRENT_CONVENIO, dataConvenio),
        dataTurno 
          ? AsyncStorage.setItem(KEYS.CURRENT_TURNO, dataTurno) 
          : AsyncStorage.removeItem(KEYS.CURRENT_TURNO),
      ]);
    } else {
      // MMKV: Síncrono e ultra rápido
      storage!.set(KEYS.CURRENT_TRANSACOES, dataTransacoes);
      storage!.set(KEYS.CURRENT_FANTASMAS, dataFantasmas);
      storage!.set(KEYS.CURRENT_LOGS, dataLogs);
      storage!.set(KEYS.CURRENT_POS, dataPOS);
      storage!.set(KEYS.CURRENT_CONVENIO, dataConvenio);
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
    let turnoRaw, transacoesRaw, fantasmasRaw, logsRaw, posRaw, convenioRaw;

    if (isWeb) {
      [turnoRaw, transacoesRaw, fantasmasRaw, logsRaw, posRaw, convenioRaw] = await Promise.all([
        AsyncStorage.getItem(KEYS.CURRENT_TURNO),
        AsyncStorage.getItem(KEYS.CURRENT_TRANSACOES),
        AsyncStorage.getItem(KEYS.CURRENT_FANTASMAS),
        AsyncStorage.getItem(KEYS.CURRENT_LOGS),
        AsyncStorage.getItem(KEYS.CURRENT_POS),
        AsyncStorage.getItem(KEYS.CURRENT_CONVENIO),
      ]);
    } else {
      turnoRaw = storage!.getString(KEYS.CURRENT_TURNO);
      transacoesRaw = storage!.getString(KEYS.CURRENT_TRANSACOES);
      fantasmasRaw = storage!.getString(KEYS.CURRENT_FANTASMAS);
      logsRaw = storage!.getString(KEYS.CURRENT_LOGS);
      posRaw = storage!.getString(KEYS.CURRENT_POS);
      convenioRaw = storage!.getString(KEYS.CURRENT_CONVENIO);
    }

    return {
      turno: turnoRaw ? (JSON.parse(turnoRaw) as Turno) : null,
      transacoes: transacoesRaw ? (JSON.parse(transacoesRaw) as Transacao[]) : [],
      fantasmas: fantasmasRaw ? (JSON.parse(fantasmasRaw) as LembreteFantasma[]) : [],
      logs: logsRaw ? (JSON.parse(logsRaw) as LogAlteracao[]) : [],
      registrosPOS: posRaw ? (JSON.parse(posRaw) as RegistroPOS[]) : [],
      registrosConvenio: convenioRaw ? (JSON.parse(convenioRaw) as RegistroConvenio[]) : [],
    };
  } catch (e) {
    console.error("Erro ao carregar cache local", e);
    return { turno: null, transacoes: [], fantasmas: [], logs: [], registrosPOS: [], registrosConvenio: [] };
  }
}

export async function clearCurrentShiftCache() {
  if (isWeb) {
    await Promise.all([
      AsyncStorage.removeItem(KEYS.CURRENT_TURNO),
      AsyncStorage.removeItem(KEYS.CURRENT_TRANSACOES),
      AsyncStorage.removeItem(KEYS.CURRENT_FANTASMAS),
      AsyncStorage.removeItem(KEYS.CURRENT_LOGS),
      AsyncStorage.removeItem(KEYS.CURRENT_POS),
      AsyncStorage.removeItem(KEYS.CURRENT_CONVENIO),
    ]);
  } else {
    storage!.remove(KEYS.CURRENT_TURNO);
    storage!.remove(KEYS.CURRENT_TRANSACOES);
    storage!.remove(KEYS.CURRENT_FANTASMAS);
    storage!.remove(KEYS.CURRENT_LOGS);
    storage!.remove(KEYS.CURRENT_POS);
    storage!.remove(KEYS.CURRENT_CONVENIO);
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

// ==================== SISTEMA DE SNAPSHOTS ====================
// Salva "fotos" do estado antes de operações destrutivas.
// Permite reverter dados caso algo dê errado (conflito multi-celular, etc.)

export interface DataSnapshot {
  id: string;
  timestamp: number;
  reason: string; // "antes_excluir_turno", "antes_fechar_turno", "manual", etc.
  turnoId: string;
  turnoDataRef: string;
  turno: Turno;
  transacoes: Transacao[];
  fantasmas: LembreteFantasma[];
  logs: LogAlteracao[];
  registrosPOS: RegistroPOS[];
  registrosConvenio: RegistroConvenio[];
}

function snapshotKey(id: string) {
  return `@squirrel_snapshot_${id}`;
}

/** Salva um snapshot automático antes de operações perigosas */
export async function saveSnapshot(
  reason: string,
  turno: Turno,
  transacoes: Transacao[],
  fantasmas: LembreteFantasma[],
  logs: LogAlteracao[] = [],
  registrosPOS: RegistroPOS[] = [],
  registrosConvenio: RegistroConvenio[] = []
): Promise<string> {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const snapshot: DataSnapshot = {
    id,
    timestamp: Date.now(),
    reason,
    turnoId: turno.id,
    turnoDataRef: turno.dataReferencia,
    turno,
    transacoes,
    fantasmas,
    logs,
    registrosPOS,
    registrosConvenio,
  };

  try {
    const data = JSON.stringify(snapshot);
    if (isWeb) {
      await AsyncStorage.setItem(snapshotKey(id), data);
    } else {
      storage!.set(snapshotKey(id), data);
    }

    // Atualiza o índice de snapshots
    const index = await getSnapshotIndex();
    index.unshift({ id, timestamp: snapshot.timestamp, reason, turnoId: turno.id, turnoDataRef: turno.dataReferencia });
    
    // Limita a MAX_SNAPSHOTS — remove os mais antigos
    while (index.length > MAX_SNAPSHOTS) {
      const removed = index.pop()!;
      if (isWeb) {
        await AsyncStorage.removeItem(snapshotKey(removed.id));
      } else {
        storage!.remove(snapshotKey(removed.id));
      }
    }

    const indexData = JSON.stringify(index);
    if (isWeb) {
      await AsyncStorage.setItem(KEYS.SNAPSHOTS_INDEX, indexData);
    } else {
      storage!.set(KEYS.SNAPSHOTS_INDEX, indexData);
    }

    console.log(`[Snapshot] Salvo: ${reason} (${id})`);
    return id;
  } catch (e) {
    console.error("Erro ao salvar snapshot", e);
    return id;
  }
}

export interface SnapshotIndexEntry {
  id: string;
  timestamp: number;
  reason: string;
  turnoId: string;
  turnoDataRef: string;
}

/** Lista todos os snapshots salvos (mais recente primeiro) */
export async function getSnapshotIndex(): Promise<SnapshotIndexEntry[]> {
  try {
    const raw = isWeb
      ? await AsyncStorage.getItem(KEYS.SNAPSHOTS_INDEX)
      : storage!.getString(KEYS.SNAPSHOTS_INDEX);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/** Carrega um snapshot completo pelo ID */
export async function loadSnapshot(id: string): Promise<DataSnapshot | null> {
  try {
    const raw = isWeb
      ? await AsyncStorage.getItem(snapshotKey(id))
      : storage!.getString(snapshotKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error("Erro ao carregar snapshot", e);
    return null;
  }
}

/** Remove um snapshot específico */
export async function deleteSnapshot(id: string): Promise<void> {
  try {
    if (isWeb) {
      await AsyncStorage.removeItem(snapshotKey(id));
    } else {
      storage!.remove(snapshotKey(id));
    }
    const index = await getSnapshotIndex();
    const filtered = index.filter(s => s.id !== id);
    const data = JSON.stringify(filtered);
    if (isWeb) {
      await AsyncStorage.setItem(KEYS.SNAPSHOTS_INDEX, data);
    } else {
      storage!.set(KEYS.SNAPSHOTS_INDEX, data);
    }
  } catch (e) {
    console.error("Erro ao deletar snapshot", e);
  }
}
