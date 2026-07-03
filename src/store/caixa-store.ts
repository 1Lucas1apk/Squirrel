import { create } from 'zustand';
import { Turno, Transacao, LembreteFantasma, LogAlteracao, RegistroPOS, RegistroConvenio } from '../types/domain';

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
  registrosPOS: RegistroPOS[];
  registrosConvenio: RegistroConvenio[];
  logs: LogAlteracao[];
  historicoTurnos: Turno[];
  loading: boolean;
  error: string | null;
  isTransacoesLoaded: boolean;
  isFantasmasLoaded: boolean;
  isRegistrosPOSLoaded: boolean;
  isRegistrosConvenioLoaded: boolean;
}

export const useCaixaStore = create<CaixaState>(() => ({
  turno: null,
  transacoes: [],
  fantasmas: [],
  registrosPOS: [],
  registrosConvenio: [],
  logs: [],
  historicoTurnos: [],
  loading: false,
  error: null,
  isTransacoesLoaded: false,
  isFantasmasLoaded: false,
  isRegistrosPOSLoaded: false,
  isRegistrosConvenioLoaded: false,
}));
