import { useEffect, useMemo } from "react";
import { calcularTotaisTurno } from "../features/fechamento/calculos";
import {
  atualizarConferenciaTransacao,
  buscarUltimoTurnoAberto,
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
} from "../services/repositories/caixa-repository";
import { LembreteFantasma, Transacao, Turno, ContagemCedulas, LogAlteracao } from "../types/domain";
import { getTodayReferenceDate } from "../utils/date";
import { clearCurrentShiftCache, saveCurrentShiftCache, loadCurrentShiftCache, saveSnapshot } from "../services/local-storage";
import { scheduleInactivityAlert } from "../services/notifications";
import { useCaixaStore } from "../store/caixa-store";

export function useCaixaSeguro(posSomaOutrosTurnos = 0) {
  const state = useCaixaStore();
  const { turno, transacoes, fantasmas, registrosPOS, registrosConvenio, logs, historicoTurnos, loading, error, isTransacoesLoaded, isFantasmasLoaded, isRegistrosPOSLoaded, isRegistrosConvenioLoaded } = state;

  // Carregamento Inicial: Cache local PRIMEIRO, depois Firebase
  useEffect(() => {
    async function init() {
      useCaixaStore.setState({ loading: true, error: null });
      try {
        // PASSO 1: Carrega do cache local (MMKV) imediatamente para mostrar dados na tela
        // Isso resolve o bug de abrir o app e não ver as transações
        const cached = await loadCurrentShiftCache();
        if (cached.turno && !useCaixaStore.getState().turno) {
          console.log("[CaixaSeguro] Restaurando dados do cache local...");
          useCaixaStore.setState({
            turno: cached.turno,
            transacoes: cached.transacoes,
            fantasmas: cached.fantasmas,
            logs: cached.logs,
            registrosPOS: cached.registrosPOS || [],
            registrosConvenio: cached.registrosConvenio || [],
            // NÃO marca como loaded — os listeners do Firestore vão sobrescrever com dados atualizados
            isTransacoesLoaded: false,
            isFantasmasLoaded: false,
            isRegistrosPOSLoaded: false,
            isRegistrosConvenioLoaded: false,
          });
        }

        // PASSO 2: Busca o último turno aberto do Firebase (pode sobrescrever o cache)
        if (!useCaixaStore.getState().turno) {
          const ultimo = await buscarUltimoTurnoAberto();
          if (ultimo) {
            useCaixaStore.setState({ turno: ultimo });
          }
        }
        await carregarHistoricoTurnos();
      } catch (err) {
        console.error("[CaixaSeguro] Erro ao iniciar:", err);
        // Se falhou mas tem cache, não mostra erro — o usuário pode usar offline
        const currentState = useCaixaStore.getState();
        if (!currentState.turno) {
          useCaixaStore.setState({ error: "Erro ao iniciar o caixa." });
        }
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
          // Se não encontrou no histórico local ainda, recarrega o histórico e tenta de novo
          import("../services/repositories/caixa-repository").then(repo => {
            repo.listarTurnosRecentes().then(todos => {
              useCaixaStore.setState({ historicoTurnos: todos });
              const t2 = todos.find(x => x.id === activeId);
              if (t2) {
                useCaixaStore.setState({ turno: t2, transacoes: [], fantasmas: [], registrosPOS: [], registrosConvenio: [], logs: [], isTransacoesLoaded: false, isFantasmasLoaded: false, isRegistrosPOSLoaded: false, isRegistrosConvenioLoaded: false });
              }
            });
          });
        }
      }
    });

    return () => {
      unsub();
    };
  }, []);

  // Backup em Local Storage (inclui POS e Convênio agora)
  useEffect(() => {
    if (turno) {
      void saveCurrentShiftCache(turno, transacoes, fantasmas, logs, registrosPOS, registrosConvenio);
    }
  }, [turno, transacoes, fantasmas, logs, registrosPOS, registrosConvenio]);

  // Ouvintes do Banco de Dados (Firestore / RTDB)
  // Proteção contra perda de dados: se o Firestore retorna vazio do cache mas
  // o local tem dados, usa o local como fallback até o servidor responder
  useEffect(() => {
    if (!turno?.id) return;
    
    const unsubTurno = ouvirTurno(turno.id, (data) => {
      useCaixaStore.setState({ turno: data || null });
    });
    
    // Helper: aceita dados do Firestore apenas se faz sentido
    // Previne o bug de "abrir o app e as transações sumirem"
    const handleFirestoreData = <T>(
      key: "transacoes" | "fantasmas" | "registrosPOS" | "registrosConvenio",
      loadedKey: "isTransacoesLoaded" | "isFantasmasLoaded" | "isRegistrosPOSLoaded" | "isRegistrosConvenioLoaded",
      data: T[],
      isSuspectEmpty?: boolean
    ) => {
      const state = useCaixaStore.getState();
      const currentData = state[key] as T[];
      const isNewTurno = state.turno && (Date.now() - state.turno.criadoEm < 5 * 60 * 1000);
      const alreadyLoaded = state[loadedKey];

      // Caso 1: dados vieram vazios do cache do Firestore (suspeito)
      // E já temos dados locais — NÃO sobrescreve, espera o servidor
      if (isSuspectEmpty && !isNewTurno) {
        if (currentData.length > 0) {
          // Já temos dados no estado (do cache MMKV), mantém eles
          console.log(`[CaixaSeguro] ${key}: Firestore cache vazio mas temos ${currentData.length} itens locais. Mantendo local.`);
          return;
        }
        // Se não temos dados locais E é a primeira vez, espera 3s antes de aceitar vazio
        if (!alreadyLoaded) {
          setTimeout(() => {
            if (!useCaixaStore.getState()[loadedKey]) {
              console.log(`[CaixaSeguro] ${key}: Timeout - aceitando resultado vazio.`);
              useCaixaStore.setState({ [key]: data, [loadedKey]: true } as any);
            }
          }, 3000);
          return;
        }
      }

      // Caso 2: dados vieram com conteúdo, ou turno é novo — aceita normalmente
      useCaixaStore.setState({ [key]: data, [loadedKey]: true } as any);
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

  const isAllLoaded = isTransacoesLoaded && isFantasmasLoaded && isRegistrosPOSLoaded && isRegistrosConvenioLoaded;

  const totais = useMemo(() => {
    // Enquanto carrega, mostra os totais que já estavam salvos no banco para não piscar R$ 0,00 na tela
    if (!isAllLoaded && turno?.totais) {
      return turno.totais;
    }
    return calcularTotaisTurno(transacoes, fantasmas, registrosPOS, registrosConvenio, turno?.ajusteManualSobra ?? 0, turno?.posRelatorioTotal ?? 0, posSomaOutrosTurnos);
  }, [isAllLoaded, turno, transacoes, fantasmas, registrosPOS, registrosConvenio, posSomaOutrosTurnos]);

  // Calcula Totais e salva na nuvem (Debounce natural já ocorre pelo design de UI)
  useEffect(() => {
    if (turno && turno.statusTurno === "aberto" && isAllLoaded) {
      // Só salva se realmente houve alteração nos totais para evitar sobrescritas indevidas e writes desnecessários
      const mudou = JSON.stringify(totais) !== JSON.stringify(turno.totais);
      if (mudou) {
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
      
      useCaixaStore.setState({ historicoTurnos: historicoAtualizado });
    } catch (err) {
      console.warn("Erro ao buscar historico", err);
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
      await deletarTurnoPermanente(id);
      const currentState = useCaixaStore.getState();
      if (currentState.turno?.id === id) useCaixaStore.setState({ turno: null });
      await carregarHistoricoTurnos();
    },
    // Snapshot manual para o botão de "backup" nas configurações
    criarSnapshotManual: async () => {
      await autoSnapshot("manual");
    },
    definirAjusteSobra: async (v: number) => {
      if (!turno) return;
      await salvarAjusteSobra(turno.id, v);
    },
    definirNotaDia: async (v: string) => {
      if (!turno) return;
      await salvarNotaDia(turno.id, v);
    },
    criarTransacao: async (input: any) => {
      if (!turno) return;
      void scheduleInactivityAlert();
      await autoSnapshot("Antes de criar transação");
      await adicionarTransacao(turno.id, input);
    },
    excluirTransacao: async (id: string) => {
      if (!turno) return;
      await autoSnapshot("Antes de excluir transação");
      await removerTransacao(turno.id, id);
    },
    editarLançamento: async (id: string, input: any) => {
      if (!turno) return;
      await autoSnapshot("Antes de editar transação");
      await editarTransacao(turno.id, id, input);
    },
    alternarConferencia: async (t: Transacao) => {
      if (!turno) return;
      const nextStatus = t.statusConferencia === "pendente" ? "confirmada" : "pendente";
      await atualizarConferenciaTransacao(turno.id, t.id, nextStatus);
    },
    alternarConferenciaPOS: async (id: string, currentStatus: string) => {
      if (!turno) return;
      const nextStatus = currentStatus === "pendente" ? "confirmada" : "pendente";
      await atualizarConferenciaPOS(turno.id, id, nextStatus);
    },
    alternarConferenciaConvenio: async (id: string, currentStatus: string) => {
      if (!turno) return;
      const nextStatus = currentStatus === "pendente" ? "confirmada" : "pendente";
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
      await editarTransacao(turno.id, id, updated);
    },
    criarFantasma: async (input: any) => {
      if (!turno) return;
      await autoSnapshot("Antes de adicionar nota");
      await adicionarFantasma(turno.id, input);
    },
    editarFantasma: async (id: string, input: any) => {
      if (!turno) return;
      await autoSnapshot("Antes de editar nota");
      await atualizarFantasmaCompleto(turno.id, id, input);
    },
    excluirFantasma: async (id: string) => {
      if (!turno) return;
      await autoSnapshot("Antes de excluir nota");
      await removerFantasma(turno.id, id);
    },
    alternarFantasmaResolvido: async (f: LembreteFantasma) => {
      if (!turno) return;
      await atualizarFantasmaCompleto(turno.id, f.id, { resolvido: !f.resolvido });
    },
    alternarFantasmaComprovado: async (f: LembreteFantasma) => {
      if (!turno) return;
      await atualizarFantasmaCompleto(turno.id, f.id, { comprovadoPix: !f.comprovadoPix });
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
      await autoSnapshot("Antes de adicionar POS");
      await adicionarRegistroPOS(turno.id, input);
    },
    editarRegistroPOS: async (id: string, input: any) => {
      if (!turno) return;
      await autoSnapshot("Antes de editar POS");
      await editarRegistroPOS(turno.id, id, input);
    },
    excluirRegistroPOS: async (id: string) => {
      if (!turno) return;
      await autoSnapshot("Antes de excluir POS");
      await removerRegistroPOS(turno.id, id);
    },
    salvarRelatorioPOSTotal: async (valor: number) => {
      if (!turno) return;
      await salvarRelatorioPOSTotal(turno.id, valor);
    },
    criarConvenio: async (input: any) => {
      if (!turno) return;
      void scheduleInactivityAlert();
      await autoSnapshot("Antes de adicionar Convênio");
      await adicionarConvenio(turno.id, input);
    },
    editarConvenio: async (id: string, input: any) => {
      if (!turno) return;
      await autoSnapshot("Antes de editar Convênio");
      await editarConvenio(turno.id, id, input);
    },
    excluirConvenio: async (id: string) => {
      if (!turno) return;
      await autoSnapshot("Antes de excluir Convênio");
      await removerConvenio(turno.id, id);
    },
    vincularRegistros: async (transacaoId: string, fantasmaId: string) => {
      if (!turno) return;
      await vincularRegistrosRepository(turno.id, transacaoId, fantasmaId);
    }
  };
}
