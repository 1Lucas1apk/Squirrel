import { useEffect, useMemo, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "../services/firebase/client";
import { calcularTotaisTurno } from "../features/fechamento/calculos";
import {
  atualizarConferenciaTransacao,
  buscarUltimoTurnoAberto,
  buscarTurnoPorId,
  criarNovoTurno,
  atualizarStatusTurno,
  listarTurnosRecentes,
  ouvirFantasmas,
  ouvirTransacoes,
  ouvirTurno,
  removerTurnoTotal,
  deletarTurnoPermanente,
  salvarAjusteSobra,
  salvarTotaisTurno,
  salvarContagemCedulas,
  atualizarIdentificacao,
  atualizarConferenciaPOS,
  atualizarConferenciaConvenio,
  atualizarStatusRepasse,
  ouvirLogsAuditoria,
  salvarNotaDia,
  adicionarTransacao,
  editarTransacao,
  removerTransacao,
  adicionarFantasma,
  vincularRegistrosRepository,
  atualizarFantasmaCompleto,
  removerFantasma,
  registrarLogAlteracao,
  ouvirRegistrosPOS,
  ouvirRegistrosConvenio,
  adicionarRegistroPOS,
  editarRegistroPOS,
  removerRegistroPOS,
  adicionarConvenio,
  editarConvenio,
  removerConvenio,
  salvarRelatorioPOSTotal,
  atualizarTurnoAtivoConta,
  ouvirTurnoAtivoConta,
  restaurarTurnoExcluido,
  importarBackupCompletoNuvem,
} from "../services/repositories/caixa-repository";
import { LembreteFantasma, Transacao, Turno, ContagemCedulas, LogAlteracao, RegistroPOS, RegistroConvenio } from "../types/domain";
import { getTodayReferenceDate } from "../utils/date";
import { clearCurrentShiftCache, saveCurrentShiftCache, loadCurrentShiftCache, saveSnapshot, saveHistoricoTurnosCache, loadHistoricoTurnosCache } from "../services/local-storage";
import { useCaixaStore } from "../store/caixa-store";
import { scheduleInactivityAlert } from "../services/notifications";

let debounceAjusteTimer: any = null;
let debounceNotaTimer: any = null;
let lastLocalAjusteTime = 0;
let lastLocalNotaTime = 0;

export function useCaixaSeguro(posSomaOutrosTurnos = 0) {
  const state = useCaixaStore();
  const { turno, transacoes, fantasmas, registrosPOS, registrosConvenio, logs, historicoTurnos, loading, error, isTransacoesLoaded, isFantasmasLoaded, isRegistrosPOSLoaded, isRegistrosConvenioLoaded } = state;
  const isAllLoaded = isTransacoesLoaded && isFantasmasLoaded && isRegistrosPOSLoaded && isRegistrosConvenioLoaded;
  const localDeletedIdsRef = useRef<Set<string>>(new Set());
  const localCreatedIdsRef = useRef<Set<string>>(new Set());
  const recentCreatedTokensRef = useRef<Map<string, number>>(new Map());

  // Carregamento Inicial: Cache local PRIMEIRO (0ms), depois sincronização em segundo plano
  useEffect(() => {
    async function init() {
      useCaixaStore.setState({ loading: true, error: null });
      try {
        // PASSO 1: Carrega do cache local EXCLUSIVAMENTE o turno ativo de hoje (0ms)
        const cachedShift = await loadCurrentShiftCache();

        if (cachedShift.turno && !useCaixaStore.getState().turno) {
          useCaixaStore.setState({
            turno: cachedShift.turno,
            transacoes: cachedShift.transacoes,
            fantasmas: cachedShift.fantasmas,
            logs: cachedShift.logs,
            registrosPOS: cachedShift.registrosPOS || [],
            registrosConvenio: cachedShift.registrosConvenio || [],
            isTransacoesLoaded: false,
            isFantasmasLoaded: false,
            isRegistrosPOSLoaded: false,
            isRegistrosConvenioLoaded: false,
          });
        }

        // Libera a tela IMEDIATAMENTE para uso em 0ms
        useCaixaStore.setState({ loading: false });

        // PASSO 2: Sincronização rápida em segundo plano apenas do turno aberto atual
        buscarUltimoTurnoAberto().then((ultimo) => {
          if (ultimo && !useCaixaStore.getState().turno) {
            useCaixaStore.setState({ turno: ultimo });
          }
        }).catch(() => {});
      } catch (err) {
        console.error("[CaixaSeguro] Erro ao iniciar do cache:", err);
      } finally {
        useCaixaStore.setState({ loading: false });
      }
    }
    init();

    // Sincronização multi-dispositivo: ouve mudanças de turno ativo na conta
    const unsub = ouvirTurnoAtivoConta((activeId) => {
      if (!activeId) return;
      const state = useCaixaStore.getState();
      if (!state.turno || state.turno.id !== activeId) {
        const t = state.historicoTurnos.find(x => x.id === activeId);
        if (t) {
          useCaixaStore.setState({ turno: t, transacoes: [], fantasmas: [], registrosPOS: [], registrosConvenio: [], logs: [], isTransacoesLoaded: false, isFantasmasLoaded: false, isRegistrosPOSLoaded: false, isRegistrosConvenioLoaded: false });
        } else {
          // Busca pontualmente apenas o turno ativo especificado, sem baixar todo o banco
          buscarTurnoPorId(activeId).then((t2) => {
            if (t2) {
              useCaixaStore.setState({ turno: t2, transacoes: [], fantasmas: [], registrosPOS: [], registrosConvenio: [], logs: [], isTransacoesLoaded: false, isFantasmasLoaded: false, isRegistrosPOSLoaded: false, isRegistrosConvenioLoaded: false });
            }
          }).catch(() => {});
        }
      }
    });

    return () => {
      unsub();
    };
  }, []);

  // Backup em Local Storage (apenas grava após hidratação completa dos dados)
  useEffect(() => {
    const isHydrated = isAllLoaded || transacoes.length > 0 || fantasmas.length > 0 || registrosPOS.length > 0 || registrosConvenio.length > 0;
    if (turno && isHydrated) {
      void saveCurrentShiftCache(turno, transacoes, fantasmas, logs, registrosPOS, registrosConvenio);
    }
  }, [turno, transacoes, fantasmas, logs, registrosPOS, registrosConvenio, isAllLoaded]);

  // Limpeza de memória dos Sets temporários ao mudar ou fechar turno
  useEffect(() => {
    localDeletedIdsRef.current.clear();
    localCreatedIdsRef.current.clear();
    recentCreatedTokensRef.current.clear();
  }, [turno?.id]);

  // Ouvintes do Banco de Dados (Firestore / RTDB)
  // Proteção contra perda de dados: se o Firestore retorna vazio do cache mas
  // o local tem dados, usa o local como fallback até o servidor responder
  useEffect(() => {
    if (!turno?.id) return;
    
    const unsubTurno = ouvirTurno(turno.id, (data) => {
      if (!data) {
        useCaixaStore.setState({ turno: null });
        return;
      }
      const current = useCaixaStore.getState().turno;
      if (current) {
        const isRecentAjuste = Date.now() - lastLocalAjusteTime < 3000;
        const isRecentNota = Date.now() - lastLocalNotaTime < 3000;
        if (isRecentAjuste || isRecentNota) {
          useCaixaStore.setState({
            turno: {
              ...data,
              ajusteManualSobra: isRecentAjuste ? current.ajusteManualSobra : data.ajusteManualSobra,
              notaDia: isRecentNota ? current.notaDia : data.notaDia,
            }
          });
          return;
        }
      }
      useCaixaStore.setState({ turno: data });
    });
    
    // Helper: aceita dados do Firestore e faz UNIÃO CAUSAL com dados locais não sincronizados
    // Garante que NENHUM pagamento ou venda feita offline seja deletada ou sobrescrita
    const handleFirestoreData = <T extends { id: string; timestamp?: number }>(
      key: "transacoes" | "fantasmas" | "registrosPOS" | "registrosConvenio",
      loadedKey: "isTransacoesLoaded" | "isFantasmasLoaded" | "isRegistrosPOSLoaded" | "isRegistrosConvenioLoaded",
      data: T[],
      isSuspectEmpty?: boolean
    ) => {
      const state = useCaixaStore.getState();
      const currentData = (state[key] as unknown as T[]) || [];
      const isNewTurno = state.turno && (Date.now() - state.turno.criadoEm < 5 * 60 * 1000);

      // Caso 1: dados vieram vazios do cache do Firestore (suspeito)
      // E já temos dados locais — NUNCA sobrescreve com vazio, preserva o local
      if (isSuspectEmpty && !isNewTurno && currentData.length > 0) {
        console.log(`[CaixaSeguro] ${key}: Firestore cache vazio mas temos ${currentData.length} itens locais. Preservando local.`);
        useCaixaStore.setState({ [loadedKey]: true } as any);
        return;
      }

      // Caso 2: União Causal Inteligente (Merge por ID com Tombstones de exclusão intencional)
      const remoteMap = new Map((data || []).map(item => [item.id, item]));
      const mergedList = [...(data || [])].filter(item => !localDeletedIdsRef.current.has(item.id));

      // Remove da lista de pendentes os itens que o servidor já confirmou
      (data || []).forEach(item => {
        localCreatedIdsRef.current.delete(item.id);
      });

      currentData.forEach(localItem => {
        if (
          localItem?.id && 
          !remoteMap.has(localItem.id) && 
          !localDeletedIdsRef.current.has(localItem.id)
        ) {
          // Mantém se foi criado localmente e ainda aguarda sincronização, OU se veio de cache suspeito
          const isPendingLocalCreation = localCreatedIdsRef.current.has(localItem.id);
          const itemAge = Date.now() - (localItem.timestamp || 0);
          if (isPendingLocalCreation || (isSuspectEmpty && itemAge < 24 * 60 * 60 * 1000)) {
            mergedList.push(localItem);
          }
        }
      });

      // Ordena por timestamp decrescente (mais recente no topo)
      mergedList.sort((a, b) => (Number(b.timestamp || 0) - Number(a.timestamp || 0)));

      useCaixaStore.setState({ [key]: mergedList, [loadedKey]: true } as any);
    };

    const unsubTransacoes = ouvirTransacoes(turno.id, (data, isSuspectEmpty) => {
      handleFirestoreData("transacoes", "isTransacoesLoaded", data, isSuspectEmpty);
    });
    
    const unsubFantasmas = ouvirFantasmas(turno.id, (data, isSuspectEmpty) => {
      handleFirestoreData("fantasmas", "isFantasmasLoaded", data, isSuspectEmpty);
    });
    
    const unsubLogs = ouvirLogsAuditoria(turno.id, (data) => {
      useCaixaStore.setState({ logs: data });
    });

    const unsubPOS = ouvirRegistrosPOS(turno.id, (data, isSuspectEmpty) => {
      handleFirestoreData("registrosPOS", "isRegistrosPOSLoaded", data, isSuspectEmpty);
    });
    
    const unsubConvenio = ouvirRegistrosConvenio(turno.id, (data, isSuspectEmpty) => {
      handleFirestoreData("registrosConvenio", "isRegistrosConvenioLoaded", data, isSuspectEmpty);
    });

    return () => {
      unsubTurno();
      unsubTransacoes();
      unsubFantasmas();
      unsubLogs();
      unsubPOS();
      unsubConvenio();
    };
  }, [turno?.id]);

  const lastSavedTotaisJsonRef = useRef("");

  const totais = useMemo(() => {
    // Enquanto carrega, mostra os totais que já estavam salvos no banco para não piscar R$ 0,00 na tela
    if (!isAllLoaded && turno?.totais) {
      return turno.totais;
    }
    return calcularTotaisTurno(
      transacoes, 
      fantasmas, 
      registrosPOS, 
      registrosConvenio, 
      turno?.ajusteManualSobra ?? 0, 
      turno?.posRelatorioTotal ?? 0, 
      posSomaOutrosTurnos
    );
  }, [isAllLoaded, turno?.ajusteManualSobra, turno?.posRelatorioTotal, turno?.totais, transacoes, fantasmas, registrosPOS, registrosConvenio, posSomaOutrosTurnos]);

  // Calcula Totais e salva na nuvem apenas quando há mudança real
  useEffect(() => {
    if (turno && turno.statusTurno === "aberto" && isAllLoaded) {
      // Proteção Anti-Zeramento: Se o turno já tinha saldo/movimento anterior,
      // e um recálculo transitório gerou 0 por oscilação de rede, ABORTA
      const tinhaSaldoAnterior = (turno.totais?.sistema && turno.totais.sistema !== 0) || (turno.totais?.gavetaFisico && turno.totais.gavetaFisico !== 0);
      const calculouZero = totais.sistema === 0 && totais.gavetaFisico === 0 && transacoes.length === 0;
      if (tinhaSaldoAnterior && calculouZero) {
        return;
      }

      // Só salva se realmente houve alteração nos totais
      const totaisJson = JSON.stringify(totais);
      const turnoTotaisJson = JSON.stringify(turno.totais);
      if (totaisJson !== turnoTotaisJson && totaisJson !== lastSavedTotaisJsonRef.current) {
        lastSavedTotaisJsonRef.current = totaisJson;
        void salvarTotaisTurno(turno.id, totais);
      }
    }
  }, [turno?.id, totais, isAllLoaded, turno?.statusTurno]);

  async function carregarHistoricoTurnos() {
    try {
      const todos = await listarTurnosRecentes();
      
      // Limpeza automática (Hard delete) apenas para turnos já na LIXEIRA há mais de 30 dias
      const TRINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;
      const agora = Date.now();
      
      const turnosNaLixeira = todos.filter(t => t.excluido);
      const lixoAntigo = turnosNaLixeira.filter(t => (agora - t.atualizadoEm) >= TRINTA_DIAS_MS);
      
      if (lixoAntigo.length > 0) {
        // Deleta os lixos antigos no background para não travar a aplicação
        Promise.all(lixoAntigo.map(t => deletarTurnoPermanente(t.id)))
          .catch(err => console.warn("Erro ao limpar lixeira antiga automaticamente:", err));
      }

      // Remove da lista os que acabamos de mandar deletar (para não aparecerem mais)
      const idsDeletados = lixoAntigo.map(t => t.id);
      const historicoAtualizado = todos.filter(t => !idsDeletados.includes(t.id));
      
      // União Causal do Histórico de Turnos:
      // Preserva EXCLUSIVAMENTE turnos criados localmente offline que ainda estão pendentes de sincronização
      const currentLocalHistorico = useCaixaStore.getState().historicoTurnos || [];
      const remoteMap = new Map(historicoAtualizado.map(t => [t.id, t]));
      const mergedHistorico = [...historicoAtualizado];
      currentLocalHistorico.forEach(localTurno => {
        const isLocalPending = Boolean(localTurno?.pendingSync || localTurno?.id?.startsWith("local_"));
        if (
          localTurno?.id && 
          isLocalPending &&
          localTurno.dataReferencia &&
          localTurno.dataReferencia.trim().length >= 8 &&
          !remoteMap.has(localTurno.id) && 
          !localDeletedIdsRef.current.has(localTurno.id) &&
          !idsDeletados.includes(localTurno.id)
        ) {
          const turnoAge = Date.now() - (localTurno.criadoEm || 0);
          if (turnoAge < 24 * 60 * 60 * 1000) {
            mergedHistorico.push(localTurno);
          }
        }
      });

      useCaixaStore.setState({ historicoTurnos: mergedHistorico });
      // Salva no disco local para consulta offline garantida (Read-Only no boot)
      void saveHistoricoTurnosCache(mergedHistorico);
    } catch (err) {
      console.warn("[CaixaSeguro] Offline ou erro ao buscar histórico na nuvem. Usando cache local.", err);
      const cached = await loadHistoricoTurnosCache();
      if (cached && cached.length > 0) {
        const validCached = cached.filter(t => t.dataReferencia && t.dataReferencia.trim().length >= 8);
        useCaixaStore.setState({ historicoTurnos: validCached });
      }
    }
  }

  // Helper: salva snapshot automaticamente antes de operações destrutivas
  async function autoSnapshot(reason: string) {
    const currentState = useCaixaStore.getState();
    if (!currentState.turno) return;
    try {
      await saveSnapshot(
        reason, 
        currentState.turno, 
        currentState.transacoes, 
        currentState.fantasmas, 
        currentState.logs, 
        currentState.registrosPOS, 
        currentState.registrosConvenio
      );
    } catch (e) {
      console.error("[Snapshot] Falha ao salvar snapshot automático:", e);
    }
  }

  // Retorna actions que agora vão direto pro Repositório, sem filas intermediárias
  return {
    turno,
    transacoes,
    fantasmas,
    registrosPOS,
    registrosConvenio,
    logs,
    historicoTurnos,
    loading,
    error,
    totais,
    syncStatus: "synced", // Não há mais status de fila
    syncConflicts: [], // Firestore resolve conflitos
    carregarHistoricoTurnos,
    carregarTurnoExistente: async (id: string) => {
      const currentTurno = useCaixaStore.getState().turno;
      if (currentTurno?.id === id) {
        return; // Já está carregado, não reseta as arrays
      }
      useCaixaStore.setState({ loading: true, error: null });
      try {
        const t = historicoTurnos.find(x => x.id === id);
        if (t) {
          useCaixaStore.setState({ turno: t, transacoes: [], fantasmas: [], registrosPOS: [], registrosConvenio: [], logs: [], isTransacoesLoaded: false, isFantasmasLoaded: false, isRegistrosPOSLoaded: false, isRegistrosConvenioLoaded: false });
          atualizarTurnoAtivoConta(id).catch(console.error);
        }
      } catch (err) {
        useCaixaStore.setState({ error: "Não foi possível carregar o caixa." });
      } finally {
        useCaixaStore.setState({ loading: false });
      }
    },
    abrirNovoCaixa: async (dataManual?: string) => {
      useCaixaStore.setState({ loading: true, error: null });
      try {
        const dataRef = (typeof dataManual === "string" && dataManual) ? dataManual : getTodayReferenceDate();
        // Novos sempre vão pro Firestore
        const novo = await criarNovoTurno(dataRef);
        useCaixaStore.setState({ turno: novo, transacoes: [], fantasmas: [], registrosPOS: [], registrosConvenio: [], logs: [], isTransacoesLoaded: false, isFantasmasLoaded: false, isRegistrosPOSLoaded: false, isRegistrosConvenioLoaded: false });
        atualizarTurnoAtivoConta(novo.id).catch(console.error);
        await carregarHistoricoTurnos();
      } catch (err) {
        console.error("Erro real ao abrirNovoCaixa:", err);
        useCaixaStore.setState({ error: "Falha ao abrir o caixa. Verifique a internet." });
      } finally {
        useCaixaStore.setState({ loading: false });
      }
    },
    registrarLog: async (transacaoId: string, log: any) => {
      if (!turno) return;
      await registrarLogAlteracao(turno.id, transacaoId, log);
    },
    sairDoDia: async () => {
      useCaixaStore.setState({ turno: null, transacoes: [], fantasmas: [], registrosPOS: [], registrosConvenio: [], logs: [], isTransacoesLoaded: false, isFantasmasLoaded: false, isRegistrosPOSLoaded: false, isRegistrosConvenioLoaded: false });
      await clearCurrentShiftCache();
    },
    fecharTurno: async () => {
      if (!turno) return;
      // Snapshot automático antes de fechar o turno
      await autoSnapshot("antes_fechar_turno");
      await atualizarStatusTurno(turno.id, "fechado");
    },
    reabrirTurno: async () => {
      if (!turno) return;
      await atualizarStatusTurno(turno.id, "aberto");
    },
    excluirTurno: async (id: string) => {
      const currentState = useCaixaStore.getState();
      const turnoAlvo = currentState.historicoTurnos.find(x => x.id === id);
      if (turnoAlvo) {
        await saveSnapshot(
          "antes_excluir_turno",
          turnoAlvo,
          currentState.turno?.id === id ? currentState.transacoes : [],
          currentState.turno?.id === id ? currentState.fantasmas : [],
          currentState.turno?.id === id ? currentState.logs : [],
          currentState.turno?.id === id ? currentState.registrosPOS : [],
          currentState.turno?.id === id ? currentState.registrosConvenio : []
        );
      }
      await removerTurnoTotal(id);
      if (currentState.turno?.id === id) useCaixaStore.setState({ turno: null });
      await carregarHistoricoTurnos();
    },
    restaurarDia: async (id: string) => {
      await restaurarTurnoExcluido(id);
      await carregarHistoricoTurnos();
    },
    deletarDiaPermanente: async (id: string) => {
      localDeletedIdsRef.current.add(id);
      await deletarTurnoPermanente(id);
      const currentState = useCaixaStore.getState();
      const filtered = (currentState.historicoTurnos || []).filter(x => x.id !== id);
      useCaixaStore.setState({ 
        historicoTurnos: filtered,
        turno: currentState.turno?.id === id ? null : currentState.turno 
      });
      await saveHistoricoTurnosCache(filtered);
      await carregarHistoricoTurnos();
    },
    // Snapshot manual para o botão de "backup" nas configurações
    criarSnapshotManual: async () => {
      await autoSnapshot("manual");
    },
    definirAjusteSobra: async (v: number | ((prev: number) => number)) => {
      const currentTurno = useCaixaStore.getState().turno;
      if (!currentTurno) return;
      const currentVal = Number(currentTurno.ajusteManualSobra || 0);
      const nextVal = typeof v === "function" ? v(currentVal) : v;
      const rounded = Math.round((Number(nextVal) + Number.EPSILON) * 100) / 100;

      lastLocalAjusteTime = Date.now();

      // 1. Atualização instantânea em memória (UI fluida a 60 FPS sem travar)
      useCaixaStore.setState(prev => ({
        turno: prev.turno ? { ...prev.turno, ajusteManualSobra: rounded } : null
      }));

      // 2. Gravação oficial no banco debounced (150ms)
      if (debounceAjusteTimer) clearTimeout(debounceAjusteTimer);
      debounceAjusteTimer = setTimeout(async () => {
        try {
          await salvarAjusteSobra(currentTurno.id, rounded);
        } catch (e) {
          console.log("[CaixaSeguro] Erro ao sincronizar ajuste:", e);
        }
      }, 150);
    },
    definirNotaDia: async (v: string) => {
      if (!turno) return;
      lastLocalNotaTime = Date.now();
      // 1. Atualização instantânea em memória
      useCaixaStore.setState(prev => ({
        turno: prev.turno ? { ...prev.turno, notaDia: v } : null
      }));

      // 2. Gravação oficial no banco debounced (400ms após o usuário parar de digitar)
      if (debounceNotaTimer) clearTimeout(debounceNotaTimer);
      debounceNotaTimer = setTimeout(async () => {
        try {
          await salvarNotaDia(turno.id, v);
        } catch (e) {
          console.log("[CaixaSeguro] Erro ao sincronizar nota do dia:", e);
        }
      }, 400);
    },
    criarTransacao: async (input: any) => {
      if (!turno) return;
      if (input?.clientLocalId) {
        const lastSeen = recentCreatedTokensRef.current.get(input.clientLocalId);
        if (lastSeen && Date.now() - lastSeen < 4000) {
          console.warn("[CaixaSeguro] Transação duplicada prevenida por clientLocalId:", input.clientLocalId);
          return;
        }
        recentCreatedTokensRef.current.set(input.clientLocalId, Date.now());
      }
      void scheduleInactivityAlert();
      void autoSnapshot("Antes de criar transação");
      const id = await adicionarTransacao(turno.id, input);
      if (id) localCreatedIdsRef.current.add(id);
    },
    excluirTransacao: async (id: string) => {
      if (!turno) return;
      localCreatedIdsRef.current.delete(id);
      localDeletedIdsRef.current.add(id);
      // Remoção otimista imediata (0ms) na UI sem esperar rede
      useCaixaStore.setState(prev => ({
        transacoes: prev.transacoes.filter(item => item.id !== id)
      }));
      void autoSnapshot("Antes de excluir transação");
      await removerTransacao(turno.id, id);
    },
    editarLançamento: async (id: string, input: any) => {
      if (!turno) return;
      void autoSnapshot("Antes de editar transação");
      await editarTransacao(turno.id, id, input);
    },
    alternarConferencia: async (t: Transacao) => {
      if (!turno) return;
      const nextStatus = t.statusConferencia === "pendente" ? "confirmada" : "pendente";
      // Atualização otimista imediata (0ms) na UI sem esperar rede
      useCaixaStore.setState(prev => ({
        transacoes: prev.transacoes.map(item => item.id === t.id ? { ...item, statusConferencia: nextStatus } : item)
      }));
      await atualizarConferenciaTransacao(turno.id, t.id, nextStatus);
    },
    alternarConferenciaPOS: async (id: string, currentStatus: string) => {
      if (!turno) return;
      const nextStatus = currentStatus === "pendente" ? "confirmada" : "pendente";
      useCaixaStore.setState(prev => ({
        registrosPOS: prev.registrosPOS.map(item => item.id === id ? { ...item, statusConferencia: nextStatus } : item)
      }));
      await atualizarConferenciaPOS(turno.id, id, nextStatus);
    },
    alternarConferenciaConvenio: async (id: string, currentStatus: string) => {
      if (!turno) return;
      const nextStatus = currentStatus === "pendente" ? "confirmada" : "pendente";
      useCaixaStore.setState(prev => ({
        registrosConvenio: prev.registrosConvenio.map(item => item.id === id ? { ...item, statusConferencia: nextStatus } : item)
      }));
      await atualizarConferenciaConvenio(turno.id, id, nextStatus);
    },
    reportarErroTransacao: async (id: string, valorSistemaNovo: number, valorReal: number, justificativa: string) => {
      if (!turno) return;
      const t = transacoes.find(x => x.id === id);
      if (!t) return;
      const updated = { 
        valorSistema: valorSistemaNovo,
        valorRecebidoFisico: valorReal,
        trocoSobra: valorReal - valorSistemaNovo,
        statusConferencia: "incorreto" as const,
        justificativaTexto: justificativa
      };
      useCaixaStore.setState(prev => ({
        transacoes: prev.transacoes.map(item => item.id === id ? { ...item, ...updated } : item)
      }));
      await editarTransacao(turno.id, id, updated);
    },
    criarFantasma: async (input: any) => {
      if (!turno) return;
      if (input?.clientLocalId) {
        const lastSeen = recentCreatedTokensRef.current.get(input.clientLocalId);
        if (lastSeen && Date.now() - lastSeen < 4000) {
          console.warn("[CaixaSeguro] Fantasma duplicado prevenido por clientLocalId:", input.clientLocalId);
          return;
        }
        recentCreatedTokensRef.current.set(input.clientLocalId, Date.now());
      }
      void autoSnapshot("Antes de adicionar nota");
      const id = await adicionarFantasma(turno.id, input);
      if (id) localCreatedIdsRef.current.add(id);
    },
    editarFantasma: async (id: string, input: any) => {
      if (!turno) return;
      void autoSnapshot("Antes de editar nota");
      await atualizarFantasmaCompleto(turno.id, id, input);
    },
    excluirFantasma: async (id: string) => {
      if (!turno) return;
      localCreatedIdsRef.current.delete(id);
      localDeletedIdsRef.current.add(id);
      useCaixaStore.setState(prev => ({
        fantasmas: prev.fantasmas.filter(item => item.id !== id)
      }));
      void autoSnapshot("Antes de excluir nota");
      await removerFantasma(turno.id, id);
    },
    alternarFantasmaResolvido: async (f: LembreteFantasma) => {
      if (!turno) return;
      const nextVal = !f.resolvido;
      useCaixaStore.setState(prev => ({
        fantasmas: prev.fantasmas.map(item => item.id === f.id ? { ...item, resolvido: nextVal } : item)
      }));
      await atualizarFantasmaCompleto(turno.id, f.id, { resolvido: nextVal });
    },
    alternarFantasmaComprovado: async (f: LembreteFantasma) => {
      if (!turno) return;
      const nextVal = !f.comprovadoPix;
      useCaixaStore.setState(prev => ({
        fantasmas: prev.fantasmas.map(item => item.id === f.id ? { ...item, comprovadoPix: nextVal } : item)
      }));
      await atualizarFantasmaCompleto(turno.id, f.id, { comprovadoPix: nextVal });
    },
    salvarContagem: async (c: ContagemCedulas) => {
      if (turno) await salvarContagemCedulas(turno.id, c);
    },
    salvarIDs: async (c: string, o: string) => {
      if (turno) await atualizarIdentificacao(turno.id, c, o);
    },
    alternarRepasse: async (id: string, repassado: boolean) => {
      await atualizarStatusRepasse(id, repassado);
      await carregarHistoricoTurnos(); 
    },
    criarRegistroPOS: async (input: any) => {
      if (!turno) return;
      void scheduleInactivityAlert();
      void autoSnapshot("Antes de adicionar POS");
      const id = await adicionarRegistroPOS(turno.id, input);
      if (id) localCreatedIdsRef.current.add(id);
    },
    editarRegistroPOS: async (id: string, input: any) => {
      if (!turno) return;
      void autoSnapshot("Antes de editar POS");
      await editarRegistroPOS(turno.id, id, input);
    },
    excluirRegistroPOS: async (id: string) => {
      if (!turno) return;
      localCreatedIdsRef.current.delete(id);
      localDeletedIdsRef.current.add(id);
      useCaixaStore.setState(prev => ({
        registrosPOS: prev.registrosPOS.filter(item => item.id !== id)
      }));
      void autoSnapshot("Antes de excluir POS");
      await removerRegistroPOS(turno.id, id);
    },
    salvarRelatorioPOSTotal: async (valor: number) => {
      if (!turno) return;
      await salvarRelatorioPOSTotal(turno.id, valor);
    },
    criarConvenio: async (input: any) => {
      if (!turno) return;
      void scheduleInactivityAlert();
      void autoSnapshot("Antes de adicionar Convênio");
      const id = await adicionarConvenio(turno.id, input);
      if (id) localCreatedIdsRef.current.add(id);
    },
    editarConvenio: async (id: string, input: any) => {
      if (!turno) return;
      void autoSnapshot("Antes de editar Convênio");
      await editarConvenio(turno.id, id, input);
    },
    excluirConvenio: async (id: string) => {
      if (!turno) return;
      localCreatedIdsRef.current.delete(id);
      localDeletedIdsRef.current.add(id);
      useCaixaStore.setState(prev => ({
        registrosConvenio: prev.registrosConvenio.filter(item => item.id !== id)
      }));
      void autoSnapshot("Antes de excluir Convênio");
      await removerConvenio(turno.id, id);
    },
    vincularRegistros: async (transacaoId: string, fantasmaId: string) => {
      if (!turno) return;
      await vincularRegistrosRepository(turno.id, transacaoId, fantasmaId);
    },
    importarTurnoCompleto: async (
      importedTurno: Turno,
      importedTx: Transacao[],
      importedFantasmas: LembreteFantasma[],
      importedLogs: LogAlteracao[] = [],
      importedPOS: RegistroPOS[] = [],
      importedConvenio: RegistroConvenio[] = []
    ) => {
      useCaixaStore.setState({ loading: true });
      try {
        // 1. Atualiza estado imediatamente no Zustand para UI responder em 0ms
        useCaixaStore.setState({
          turno: importedTurno,
          transacoes: importedTx,
          fantasmas: importedFantasmas,
          logs: importedLogs,
          registrosPOS: importedPOS,
          registrosConvenio: importedConvenio,
          isTransacoesLoaded: true,
          isFantasmasLoaded: true,
          isRegistrosPOSLoaded: true,
          isRegistrosConvenioLoaded: true,
          loading: false,
        });

        // 2. Salva no cache local nativo MMKV
        await saveCurrentShiftCache(
          importedTurno,
          importedTx,
          importedFantasmas,
          importedLogs,
          importedPOS,
          importedConvenio
        );

        // 3. Persiste no banco de dados na nuvem (Firestore)
        try {
          await importarBackupCompletoNuvem(
            importedTurno,
            importedTx,
            importedFantasmas,
            importedLogs,
            importedPOS,
            importedConvenio
          );
          await atualizarTurnoAtivoConta(importedTurno.id);
        } catch (cloudErr) {
          console.warn("[CaixaSeguro] Erro ao sincronizar nuvem no import, salvo localmente:", cloudErr);
        }

        // 4. Recarrega histórico de turnos
        await carregarHistoricoTurnos();
      } finally {
        useCaixaStore.setState({ loading: false });
      }
    }
  };
}
