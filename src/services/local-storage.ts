import { Platform } from 'react-native';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createMMKV } from 'react-native-mmkv';
import { Turno, Transacao, LembreteFantasma, LogAlteracao, RegistroPOS, RegistroConvenio } from "../types/domain";
import { getUid } from "./auth-storage";

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
  HISTORICO_TURNOS: "@squirrel_cache_historico_turnos",
  OFFLINE_QUEUE: "@squirrel_offline_queue",
  SNAPSHOTS_INDEX: "@squirrel_snapshots_index",
  OPERATOR_PROFILE: "@squirrel_saved_operator_profile",
};

export interface SavedProfileData {
  userId?: string;
  displayName: string;
  username: string;
  cargo: string;
  isAdmin: boolean;
  photoUrl?: string | null;
  recado?: string | null;
  statusPreset?: string | null;
}

export function getSavedOperatorProfileSync(userId?: string): SavedProfileData | null {
  try {
    const key = userId ? `${KEYS.OPERATOR_PROFILE}_${userId}` : KEYS.OPERATOR_PROFILE;
    const raw = isWeb ? null : storage?.getString(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        if (userId && parsed.userId && parsed.userId !== userId) return null;
        return parsed;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSavedOperatorProfileSync(profile: SavedProfileData, userId?: string): void {
  try {
    const targetId = userId || profile.userId;
    const key = targetId ? `${KEYS.OPERATOR_PROFILE}_${targetId}` : KEYS.OPERATOR_PROFILE;
    const raw = JSON.stringify({ ...profile, userId: targetId });
    if (isWeb) {
      AsyncStorage.setItem(key, raw).catch(() => {});
    } else {
      storage?.set(key, raw);
    }
  } catch {}
}

const MAX_SNAPSHOTS = 60;

// Gera a chave particionada por conta para garantir que cada usuário só acesse seu próprio cache
async function getAccountKey(baseKey: string): Promise<string> {
  try {
    const uid = await getUid();
    return uid ? `${baseKey}_${uid}` : baseKey;
  } catch {
    return baseKey;
  }
}

export async function saveHistoricoTurnosCache(turnos: Turno[]): Promise<void> {
  try {
    if (!turnos || !Array.isArray(turnos)) return;
    const key = await getAccountKey(KEYS.HISTORICO_TURNOS);
    const raw = JSON.stringify(turnos);
    if (isWeb) {
      await AsyncStorage.setItem(key, raw);
    } else {
      storage!.set(key, raw);
    }
  } catch (e) {
    console.error("Erro ao salvar cache do histórico", e);
  }
}

export async function loadHistoricoTurnosCache(): Promise<Turno[]> {
  try {
    const key = await getAccountKey(KEYS.HISTORICO_TURNOS);
    let raw: string | null | undefined;
    if (isWeb) {
      raw = await AsyncStorage.getItem(key);
    } else {
      raw = storage!.getString(key);
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    return [];
  } catch (e) {
    console.error("Erro ao ler cache do histórico", e);
    return [];
  }
}

export async function clearHistoricoTurnosCache() {
  try {
    const key = await getAccountKey(KEYS.HISTORICO_TURNOS);
    if (isWeb) {
      await AsyncStorage.removeItem(key);
      await AsyncStorage.removeItem(KEYS.HISTORICO_TURNOS);
    } else {
      storage?.remove(key);
      storage?.remove(KEYS.HISTORICO_TURNOS);
    }
  } catch {}
}

export async function saveCurrentShiftCache(
  turno: Turno | null,
  transacoes: Transacao[],
  fantasmas: LembreteFantasma[],
  logs: LogAlteracao[] = [],
  registrosPOS: RegistroPOS[] = [],
  registrosConvenio: RegistroConvenio[] = []
) {
  try {
    const [kTurno, kTx, kFantasmas, kLogs, kPOS, kConvenio] = await Promise.all([
      getAccountKey(KEYS.CURRENT_TURNO),
      getAccountKey(KEYS.CURRENT_TRANSACOES),
      getAccountKey(KEYS.CURRENT_FANTASMAS),
      getAccountKey(KEYS.CURRENT_LOGS),
      getAccountKey(KEYS.CURRENT_POS),
      getAccountKey(KEYS.CURRENT_CONVENIO),
    ]);

    const dataTransacoes = JSON.stringify(transacoes);
    const dataFantasmas = JSON.stringify(fantasmas);
    const dataLogs = JSON.stringify(logs);
    const dataTurno = turno ? JSON.stringify(turno) : null;
    const dataPOS = JSON.stringify(registrosPOS);
    const dataConvenio = JSON.stringify(registrosConvenio);

    if (isWeb) {
      await Promise.all([
        AsyncStorage.setItem(kTx, dataTransacoes),
        AsyncStorage.setItem(kFantasmas, dataFantasmas),
        AsyncStorage.setItem(kLogs, dataLogs),
        AsyncStorage.setItem(kPOS, dataPOS),
        AsyncStorage.setItem(kConvenio, dataConvenio),
        dataTurno 
          ? AsyncStorage.setItem(kTurno, dataTurno) 
          : AsyncStorage.removeItem(kTurno),
      ]);
    } else {
      // MMKV: Síncrono e ultra rápido particionado por conta
      storage!.set(kTx, dataTransacoes);
      storage!.set(kFantasmas, dataFantasmas);
      storage!.set(kLogs, dataLogs);
      storage!.set(kPOS, dataPOS);
      storage!.set(kConvenio, dataConvenio);
      if (dataTurno) {
        storage!.set(kTurno, dataTurno);
      } else {
        storage!.remove(kTurno);
      }
    }
  } catch (e) {
    console.error("Erro ao salvar cache local", e);
  }
}

export async function loadCurrentShiftCache() {
  try {
    const [kTurno, kTx, kFantasmas, kLogs, kPOS, kConvenio] = await Promise.all([
      getAccountKey(KEYS.CURRENT_TURNO),
      getAccountKey(KEYS.CURRENT_TRANSACOES),
      getAccountKey(KEYS.CURRENT_FANTASMAS),
      getAccountKey(KEYS.CURRENT_LOGS),
      getAccountKey(KEYS.CURRENT_POS),
      getAccountKey(KEYS.CURRENT_CONVENIO),
    ]);

    let turnoRaw, transacoesRaw, fantasmasRaw, logsRaw, posRaw, convenioRaw;

    if (isWeb) {
      [turnoRaw, transacoesRaw, fantasmasRaw, logsRaw, posRaw, convenioRaw] = await Promise.all([
        AsyncStorage.getItem(kTurno),
        AsyncStorage.getItem(kTx),
        AsyncStorage.getItem(kFantasmas),
        AsyncStorage.getItem(kLogs),
        AsyncStorage.getItem(kPOS),
        AsyncStorage.getItem(kConvenio),
      ]);
    } else {
      turnoRaw = storage!.getString(kTurno);
      transacoesRaw = storage!.getString(kTx);
      fantasmasRaw = storage!.getString(kFantasmas);
      logsRaw = storage!.getString(kLogs);
      posRaw = storage!.getString(kPOS);
      convenioRaw = storage!.getString(kConvenio);
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
  const [kTurno, kTx, kFantasmas, kLogs, kPOS, kConvenio] = await Promise.all([
    getAccountKey(KEYS.CURRENT_TURNO),
    getAccountKey(KEYS.CURRENT_TRANSACOES),
    getAccountKey(KEYS.CURRENT_FANTASMAS),
    getAccountKey(KEYS.CURRENT_LOGS),
    getAccountKey(KEYS.CURRENT_POS),
    getAccountKey(KEYS.CURRENT_CONVENIO),
  ]);

  if (isWeb) {
    await Promise.all([
      AsyncStorage.removeItem(kTurno),
      AsyncStorage.removeItem(kTx),
      AsyncStorage.removeItem(kFantasmas),
      AsyncStorage.removeItem(kLogs),
      AsyncStorage.removeItem(kPOS),
      AsyncStorage.removeItem(kConvenio),
      AsyncStorage.removeItem(KEYS.CURRENT_TURNO),
      AsyncStorage.removeItem(KEYS.CURRENT_TRANSACOES),
      AsyncStorage.removeItem(KEYS.CURRENT_FANTASMAS),
      AsyncStorage.removeItem(KEYS.CURRENT_LOGS),
      AsyncStorage.removeItem(KEYS.CURRENT_POS),
      AsyncStorage.removeItem(KEYS.CURRENT_CONVENIO),
    ]);
  } else {
    storage?.remove(kTurno);
    storage?.remove(kTx);
    storage?.remove(kFantasmas);
    storage?.remove(kLogs);
    storage?.remove(kPOS);
    storage?.remove(kConvenio);
    storage?.remove(KEYS.CURRENT_TURNO);
    storage?.remove(KEYS.CURRENT_TRANSACOES);
    storage?.remove(KEYS.CURRENT_FANTASMAS);
    storage?.remove(KEYS.CURRENT_LOGS);
    storage?.remove(KEYS.CURRENT_POS);
    storage?.remove(KEYS.CURRENT_CONVENIO);
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
