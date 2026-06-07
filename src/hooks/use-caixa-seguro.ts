import { useEffect, useMemo, useRef } from "react";
import { calcularTotaisTurno } from "../features/fechamento/calculos";
import {
  atualizarConferenciaTransacao,
  buscarTurnoPorId,
  buscarUltimoTurnoAberto,
  criarNovoTurno,
  atualizarStatusTurno,
  listarTurnosRecentes,
  ouvirFantasmas,
  ouvirTransacoes,
  ouvirTurno,
  removerTurnoTotal,
  salvarAjusteSobra,
  salvarTotaisTurno,
  salvarContagemCedulas,
  atualizarIdentificacao,
  atualizarStatusRepasse,
  ouvirLogsAuditoria,
  salvarNotaDia
} from "../services/repositories/caixa-repository";
import { LembreteFantasma, Transacao, Turno, ContagemCedulas, LogAlteracao } from "../types/domain";
import { getTodayReferenceDate } from "../utils/date";
import { clearCurrentShiftCache, getOfflineQueue, loadCurrentShiftCache, QueuedAction, saveCurrentShiftCache } from "../services/local-storage";
import { syncManager } from "../services/sync-manager";
import { scheduleInactivityAlert } from "../services/notifications";
import { useCaixaStore } from "../store/caixa-store";

export function useCaixaSeguro() {
  const state = useCaixaStore();
  const { turno, transacoes, fantasmas, logs, historicoTurnos, loading, error, syncStatus, syncConflicts } = state;
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const rawRemoteTransacoes = useRef<Transacao[]>([]);
  const rawRemoteFantasmas = useRef<LembreteFantasma[]>([]);

  // 1. Carregamento do Cache Local (Offline First)
  useEffect(() => {
    async function init() {
      const cache = await loadCurrentShiftCache();
      useCaixaStore.setState({
        turno: cache.turno || null,
        transacoes: cache.transacoes || [],
        fantasmas: cache.fantasmas || [],
        logs: cache.logs || []
      });
      // Tenta processar qualquer coisa que ficou na fila
      void syncManager.processQueue();
    }
    init();
  }, []);

  // 2. Backup Automático para Local Storage
  useEffect(() => {
    if (turno) {
      void saveCurrentShiftCache(turno, transacoes, fantasmas, logs);
    }
  }, [turno, transacoes, fantasmas, logs]);

  // Monitora o status da fila. Quando a fila esvazia ou anda, re-mesclamos o estado
  useEffect(() => {
    const unsub = syncManager.subscribeStatus((status) => {
      useCaixaStore.setState({ syncStatus: status });
      if (turno?.id) {
        void (async () => {
          const queue = await getOfflineQueue();
          useCaixaStore.setState((prev) => ({
            transacoes: mergeTransacoesWithQueue(rawRemoteTransacoes.current, prev.transacoes, queue, turno.id),
            fantasmas: mergeFantasmasWithQueue(rawRemoteFantasmas.current, prev.fantasmas, queue, turno.id),
            syncConflicts: [
              ...detectConflicts(rawRemoteTransacoes.current, queue, turno.id, "transacao"),
              ...detectConflicts(rawRemoteFantasmas.current, queue, turno.id, "fantasma")
            ]
          }));
        })();
      }
    });
    return () => unsub();
  }, [turno?.id]);

  function detectConflicts(remoteItems: any[], queue: QueuedAction[], turnoId: string, entityType: "transacao" | "fantasma") {
    const remoteById = new Map(remoteItems.map((item) => [String(item.id), item]));
    return queue
      .filter((action) => {
        if (entityType === "transacao") return action.type === "EDIT_TRANSACAO" || action.type === "REMOVE_TRANSACAO";
        return action.type === "EDIT_FANTASMA" || action.type === "REMOVE_FANTASMA";
      })
      .filter((action) => action.payload.turnoId === turnoId)
      .filter((action) => action.payload?.id && !String(action.payload.id).startsWith("local_"))
      .filter((action) => !remoteById.has(String(action.payload.id))) // SÓ É CONFLITO SE FOI APAGADO NA NUVEM
      .map((action) => {
        const id = String(action.payload.id);
        const localItem = action.payload.input || null;
        return {
          actionId: action.id,
          entityType,
          entityId: id,
          turnoId,
          reason: "Este item foi modificado offline, mas não existe mais na nuvem (foi apagado).",
          remoteData: null,
          localData: localItem,
        };
      });
  }

  function mergeTransacoesWithQueue(remote: Transacao[], local: Transacao[], queue: QueuedAction[], turnoId: string) {
    const byId = new Map(remote.map((item) => [item.id, item]));
    const localToRemoteId = new Map(
      remote
        .filter((value): value is Transacao & { clientLocalId: string } => Boolean(value.clientLocalId))
        .map((item) => [item.clientLocalId, item.id])
    );

    const pendingLocalAddIds = new Set(
      queue
        .filter((action) => action.type === "ADD_TRANSACAO" && action.payload?.turnoId === turnoId && action.payload?.localId)
        .map((action) => String(action.payload.localId))
    );
    const syncedLocalIds = new Set(
      remote
        .map((item) => item.clientLocalId)
        .filter((value): value is string => Boolean(value))
    );

    for (const action of queue) {
      if (action.payload?.turnoId !== turnoId) continue;
      if (action.type === "EDIT_TRANSACAO" && action.payload?.id) {
        const targetId = localToRemoteId.get(action.payload.id) || action.payload.id;
        const current = byId.get(targetId);
        if (current) {
          byId.set(targetId, { ...current, ...action.payload.input, pendingSync: true });
        }
      }
      if (action.type === "REMOVE_TRANSACAO" && action.payload?.id) {
        const targetId = localToRemoteId.get(action.payload.id) || action.payload.id;
        byId.delete(targetId);
      }
    }

    const queueTargetIds = new Set(
      queue.map(a => String(a.payload?.id || a.payload?.localId))
    );

    for (const localItem of local) {
      if (localItem.id.startsWith("local_")) {
        const localId = localItem.clientLocalId ?? localItem.id;
        const stillPending = pendingLocalAddIds.has(localId);
        const alreadySynced = syncedLocalIds.has(localId);
        if (!stillPending || alreadySynced) continue;
        byId.set(localItem.id, localItem);
      } else if (localItem.pendingSync) {
        const targetIdMatches = queueTargetIds.has(localItem.id) || (localItem.clientLocalId && queueTargetIds.has(localItem.clientLocalId));
        if (targetIdMatches) {
          byId.set(localItem.id, localItem);
        }
      }
    }

    return [...byId.values()].sort((a, b) => b.timestamp - a.timestamp);
  }

  function mergeFantasmasWithQueue(remote: LembreteFantasma[], local: LembreteFantasma[], queue: QueuedAction[], turnoId: string) {
    const byId = new Map(remote.map((item) => [item.id, item]));
    const pendingLocalAddIds = new Set(
      queue
        .filter((action) => action.type === "ADD_FANTASMA" && action.payload?.turnoId === turnoId && action.payload?.localId)
        .map((action) => String(action.payload.localId))
    );
    const syncedLocalIds = new Set(
      remote
        .map((item) => item.clientLocalId)
        .filter((value): value is string => Boolean(value))
    );

    for (const action of queue) {
      if (action.payload?.turnoId !== turnoId) continue;
      if (action.type === "EDIT_FANTASMA" && action.payload?.id) {
        const current = byId.get(action.payload.id);
        if (current) {
          byId.set(action.payload.id, { ...current, ...action.payload.input, pendingSync: true });
        }
      }
      if (action.type === "REMOVE_FANTASMA" && action.payload?.id) {
        byId.delete(action.payload.id);
      }
    }

    for (const localItem of local) {
      if (localItem.id.startsWith("local_")) {
        const localId = localItem.clientLocalId ?? localItem.id;
        const stillPending = pendingLocalAddIds.has(localId);
        const alreadySynced = syncedLocalIds.has(localId);
        if (!stillPending || alreadySynced) continue;
      }
      if (localItem.pendingSync || localItem.id.startsWith("local_")) {
        byId.set(localItem.id, localItem);
      }
    }

    return [...byId.values()].sort((a, b) => b.timestamp - a.timestamp);
  }

  useEffect(() => {
    if (!turno?.id) return;
    const unsubTurno = ouvirTurno(turno.id, (data) => {
      useCaixaStore.setState({ turno: data || null });
    });
    
    const unsubTransacoes = ouvirTransacoes(turno.id, (remoteData) => {
      rawRemoteTransacoes.current = remoteData;
      void (async () => {
        const queue = await getOfflineQueue();
        useCaixaStore.setState((prev) => ({
          transacoes: mergeTransacoesWithQueue(remoteData, prev.transacoes, queue, turno.id),
          syncConflicts: [
            ...prev.syncConflicts.filter((item) => item.entityType !== "transacao" || item.turnoId !== turno.id),
            ...detectConflicts(remoteData, queue, turno.id, "transacao")
          ]
        }));
      })();
    });
    
    const unsubFantasmas = ouvirFantasmas(turno.id, (remoteData) => {
      rawRemoteFantasmas.current = remoteData;
      void (async () => {
        const queue = await getOfflineQueue();
        useCaixaStore.setState((prev) => ({
          fantasmas: mergeFantasmasWithQueue(remoteData, prev.fantasmas, queue, turno.id),
          syncConflicts: [
            ...prev.syncConflicts.filter((item) => item.entityType !== "fantasma" || item.turnoId !== turno.id),
            ...detectConflicts(remoteData, queue, turno.id, "fantasma")
          ]
        }));
      })();
    });
    
    const unsubLogs = ouvirLogsAuditoria(turno.id, (data) => {
      useCaixaStore.setState({ logs: data });
    });

    return () => {
      unsubTurno();
      unsubTransacoes();
      unsubFantasmas();
      unsubLogs();
    };
  }, [turno?.id]);

  const totais = useMemo(
    () => calcularTotaisTurno(transacoes, fantasmas, turno?.ajusteManualSobra ?? 0),
    [transacoes, fantasmas, turno?.ajusteManualSobra]
  );

  useEffect(() => {
    if (!turno || syncStatus.pendingCount > 0) return;
    const current = turno.totais;
    const isConsistent =
      Math.abs(current.sistema - totais.sistema) < 0.01 &&
      Math.abs(current.sobra - totais.sobra) < 0.01 &&
      Math.abs(current.gavetaFisico - totais.gavetaFisico) < 0.01;
    if (!isConsistent) {
      useCaixaStore.setState({ error: "Sincronização concluída, mas os totais não conferem. Revise o painel." });
    }
  }, [syncStatus.pendingCount, syncStatus.lastSyncedAt, turno?.id, totais.sistema, totais.sobra, totais.gavetaFisico]);

  useEffect(() => {
    if (!turno?.id) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const current = turno.totais;
      if (totais.sistema !== current.sistema || totais.sobra !== current.sobra || totais.gavetaFisico !== current.gavetaFisico) {
        void syncManager.queueAction({
          type: "SAVE_TOTAIS",
          payload: { turnoId: turno.id, totais }
        });
      }
    }, 3000); 
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [totais]);

  async function iniciarNovoDia() {
    useCaixaStore.setState({ loading: true });
    try { 
      const created = await criarNovoTurno(getTodayReferenceDate()); 
      useCaixaStore.setState({ turno: created }); 
      void scheduleInactivityAlert();
    } catch (err) { 
      useCaixaStore.setState({ error: "Erro ao iniciar dia." }); 
    } finally { 
      useCaixaStore.setState({ loading: false }); 
    }
  }

  async function continuarDiaAnterior() {
    useCaixaStore.setState({ loading: true });
    try { 
      const openTurno = await buscarUltimoTurnoAberto(); 
      if (openTurno) useCaixaStore.setState({ turno: openTurno }); 
      else useCaixaStore.setState({ error: "Nenhum turno aberto." }); 
    } catch (err) { 
      useCaixaStore.setState({ error: "Erro ao carregar turno." }); 
    } finally { 
      useCaixaStore.setState({ loading: false }); 
    }
  }

  async function carregarHistoricoTurnos() {
    useCaixaStore.setState({ loading: true });
    try { 
      const list = await listarTurnosRecentes(); 
      useCaixaStore.setState({ historicoTurnos: list }); 
    } finally { 
      useCaixaStore.setState({ loading: false }); 
    }
  }

  async function abrirTurnoPorId(turnoId: string) {
    useCaixaStore.setState({ loading: true });
    try { 
      const found = await buscarTurnoPorId(turnoId); 
      if (found) useCaixaStore.setState({ turno: found }); 
    } finally { 
      useCaixaStore.setState({ loading: false }); 
    }
  }

  return {
    turno, transacoes, fantasmas, logs, historicoTurnos, totais, loading, error,
    syncStatus, syncConflicts,
    iniciarNovoDia, continuarDiaAnterior, carregarHistoricoTurnos, abrirTurnoPorId,
    limparErroSync: () => {
      useCaixaStore.setState({ error: null });
      syncManager.clearLastError();
    },
    resolverConflito: async (actionId: string, strategy: "keep-local" | "keep-remote") => {
      const queue = await getOfflineQueue();
      const conflictAction = queue.find((item) => item.id === actionId);
      if (!conflictAction) {
        useCaixaStore.setState(prev => ({ syncConflicts: prev.syncConflicts.filter((item) => item.actionId !== actionId) }));
        return;
      }
      if (strategy === "keep-remote") {
        await syncManager.removeQueuedAction(actionId);
      } else {
        await syncManager.upsertQueuedAction({
          ...conflictAction,
          attempts: 0,
          nextRetryAt: 0,
          lastError: undefined,
        });
      }
      useCaixaStore.setState(prev => ({ syncConflicts: prev.syncConflicts.filter((item) => item.actionId !== actionId) }));
    },
    registrarLog: (transacaoId: string, log: any) => {
      if (!turno) return Promise.resolve();
      useCaixaStore.setState(prev => ({ logs: [{ ...log, id: "local_" + Math.random(), transacaoId, timestamp: Date.now() }, ...prev.logs] }));
      return syncManager.queueAction({
        type: "ADD_LOG",
        payload: { turnoId: turno.id, transacaoId, log }
      });
    },
    sairDoDia: async () => {
      useCaixaStore.setState({ turno: null, transacoes: [], fantasmas: [], logs: [] });
      await clearCurrentShiftCache();
    },
    fecharTurno: () => {
      if (!turno) return Promise.resolve();
      return syncManager.queueAction({
        type: "UPDATE_TURNO_STATUS",
        payload: { turnoId: turno.id, status: "fechado" }
      });
    },
    reabrirTurno: () => {
      if (!turno) return Promise.resolve();
      return syncManager.queueAction({
        type: "UPDATE_TURNO_STATUS",
        payload: { turnoId: turno.id, status: "aberto" }
      });
    },
    excluirTurno: async (id: string) => {
      await removerTurnoTotal(id);
      if (turno?.id === id) useCaixaStore.setState({ turno: null });
      carregarHistoricoTurnos();
    },
    definirAjusteSobra: (v: number) => {
      if (!turno) return Promise.resolve();
      useCaixaStore.setState(prev => ({ turno: prev.turno ? { ...prev.turno, ajusteManualSobra: v } : null }));
      return salvarAjusteSobra(turno.id, v);
    },
    definirNotaDia: (v: string) => {
      if (!turno) return Promise.resolve();
      useCaixaStore.setState(prev => ({ turno: prev.turno ? { ...prev.turno, notaDia: v } : null }));
      return salvarNotaDia(turno.id, v);
    },
    criarTransacao: (input: any) => {
      if (!turno) return Promise.resolve();
      const tempId = "local_" + Math.random().toString(36).substr(2, 9);
      const now = Date.now();
      useCaixaStore.setState(prev => ({
        transacoes: [{ 
          ...input, 
          id: tempId, 
          clientLocalId: tempId,
          timestamp: now, 
          statusConferencia: "pendente",
          pendingSync: true 
        }, ...prev.transacoes]
      }));

      void scheduleInactivityAlert();

      return syncManager.queueAction({
        type: "ADD_TRANSACAO",
        payload: { turnoId: turno.id, localId: tempId, input: { ...input, clientLocalId: tempId } }
      });
    },
    excluirTransacao: (id: string) => {
      if (!turno) return Promise.resolve();
      useCaixaStore.setState(prev => ({ transacoes: prev.transacoes.filter(t => t.id !== id) }));
      return syncManager.queueAction({
        type: "REMOVE_TRANSACAO",
        payload: { turnoId: turno.id, id }
      });
    },
    editarLançamento: (id: string, input: any) => {
      if (!turno) return Promise.resolve();
      useCaixaStore.setState(prev => ({ transacoes: prev.transacoes.map(t => t.id === id ? { ...t, ...input, pendingSync: true } : t) }));
      return syncManager.queueAction({
        type: "EDIT_TRANSACAO",
        payload: { turnoId: turno.id, id, input }
      });
    },
    alternarConferencia: (t: Transacao) => {
      if (!turno) return Promise.resolve();
      const nextStatus = t.statusConferencia === "pendente" ? "confirmada" : "pendente";
      useCaixaStore.setState(prev => ({ transacoes: prev.transacoes.map(item => item.id === t.id ? { ...item, statusConferencia: nextStatus } : item) }));
      return atualizarConferenciaTransacao(turno.id, t.id, nextStatus);
    },
    reportarErroTransacao: (id: string, valorSistemaNovo: number, valorReal: number, justificativa: string) => {
      if (!turno) return Promise.resolve();
      const t = transacoes.find(x => x.id === id);
      if (!t) return Promise.resolve();
      const updated = { 
        ...t,
        valorSistema: valorSistemaNovo,
        valorRecebidoFisico: valorReal,
        trocoSobra: valorReal - valorSistemaNovo,
        statusConferencia: "incorreto" as const,
        justificativaTexto: justificativa
      };
      useCaixaStore.setState(prev => ({ transacoes: prev.transacoes.map(item => item.id === id ? { ...updated, pendingSync: true } : item) }));
      return syncManager.queueAction({
        type: "EDIT_TRANSACAO",
        payload: { turnoId: turno.id, id, input: updated }
      });
    },
    criarFantasma: (input: any) => {
      if (!turno) return Promise.resolve();
      const tempId = "local_" + Math.random().toString(36).substr(2, 9);
      const now = Date.now();
      useCaixaStore.setState(prev => ({
        fantasmas: [{
          ...input,
          id: tempId,
          clientLocalId: tempId,
          timestamp: now,
          resolvido: false,
          comprovadoPix: false,
          pendingSync: true
        }, ...prev.fantasmas]
      }));
      return syncManager.queueAction({
        type: "ADD_FANTASMA",
        payload: { turnoId: turno.id, localId: tempId, input: { ...input, clientLocalId: tempId } }
      });
    },
    editarFantasma: (id: string, input: any) => {
      if (!turno) return Promise.resolve();
      useCaixaStore.setState(prev => ({ fantasmas: prev.fantasmas.map(f => f.id === id ? { ...f, ...input, pendingSync: true } : f) }));
      return syncManager.queueAction({
        type: "EDIT_FANTASMA",
        payload: { turnoId: turno.id, id, input }
      });
    },
    excluirFantasma: (id: string) => {
      if (!turno) return Promise.resolve();
      useCaixaStore.setState(prev => ({ fantasmas: prev.fantasmas.filter(f => f.id !== id) }));
      return syncManager.queueAction({
        type: "REMOVE_FANTASMA",
        payload: { turnoId: turno.id, id }
      });
    },
    alternarFantasmaResolvido: (f: LembreteFantasma) => {
      if (!turno) return Promise.resolve();
      const updated = { ...f, resolvido: !f.resolvido };
      useCaixaStore.setState(prev => ({ fantasmas: prev.fantasmas.map(item => item.id === f.id ? { ...updated, pendingSync: true } : item) }));
      return syncManager.queueAction({
        type: "EDIT_FANTASMA",
        payload: { turnoId: turno.id, id: f.id, input: updated }
      });
    },
    alternarFantasmaComprovado: (f: LembreteFantasma) => {
      if (!turno) return Promise.resolve();
      const updated = { ...f, comprovadoPix: !f.comprovadoPix };
      useCaixaStore.setState(prev => ({ fantasmas: prev.fantasmas.map(item => item.id === f.id ? { ...updated, pendingSync: true } : item) }));
      return syncManager.queueAction({
        type: "EDIT_FANTASMA",
        payload: { turnoId: turno.id, id: f.id, input: updated }
      });
    },
    salvarContagem: (c: ContagemCedulas) => turno ? salvarContagemCedulas(turno.id, c) : Promise.resolve(),
    salvarIDs: (c: string, o: string) => turno ? atualizarIdentificacao(turno.id, c, o) : Promise.resolve(),
    alternarRepasse: async (id: string, repassado: boolean) => {
      await atualizarStatusRepasse(id, repassado);
      carregarHistoricoTurnos(); 
    },
  };
}
