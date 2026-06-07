import { create } from 'zustand';
import { Turno, Transacao, LembreteFantasma, LogAlteracao } from '../types/domain';
import { SyncStatus } from '../services/sync-manager';

export interface SyncConflict {
  actionId: string;
  entityType: "transacao" | "fantasma";
  entityId: string;
  turnoId: string;
  reason: string;
  remoteData?: any;
  localData?: any;
}

interface CaixaState {
  turno: Turno | null;
  transacoes: Transacao[];
  fantasmas: LembreteFantasma[];
  logs: LogAlteracao[];
  historicoTurnos: Turno[];
  loading: boolean;
  error: string | null;
  syncStatus: SyncStatus;
  syncConflicts: SyncConflict[];
}

export const useCaixaStore = create<CaixaState>(() => ({
  turno: null,
  transacoes: [],
  fantasmas: [],
  logs: [],
  historicoTurnos: [],
  loading: false,
  error: null,
  syncStatus: {
    isProcessing: false,
    pendingCount: 0,
    nextRetryAt: null,
    lastError: null,
    lastSyncedAt: null,
    queue: [],
  },
  syncConflicts: [],
}));
