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
} from "../services/repositories/caixa-repository";
import { LembreteFantasma, Transacao, Turno, ContagemCedulas, LogAlteracao } from "../types/domain";
import { getTodayReferenceDate } from "../utils/date";
import { clearCurrentShiftCache, saveCurrentShiftCache } from "../services/local-storage";
import { scheduleInactivityAlert } from "../services/notifications";
import { useCaixaStore } from "../store/caixa-store";

export function useCaixaSeguro(posSomaOutrosTurnos = 0) {
  const state = useCaixaStore();
  const { turno, transacoes, fantasmas, registrosPOS, registrosConvenio, logs, historicoTurnos, loading, error, isTransacoesLoaded, isFantasmasLoaded, isRegistrosPOSLoaded, isRegistrosConvenioLoaded } = state;

  // Carregamento Inicial (Busca o último turno aberto se não houver um ativo)
  useEffect(() => {
    async function init() {
      useCaixaStore.setState({ loading: true, error: null });
      try {
        if (!useCaixaStore.getState().turno) {
          const ultimo = await buscarUltimoTurnoAberto();
          if (ultimo) {
            useCaixaStore.setState({ turno: ultimo });
          }
        }
        await carregarHistoricoTurnos();
      } catch (err) {
        useCaixaStore.setState({ error: "Erro ao iniciar o caixa." });
      } finally {
        useCaixaStore.setState({ loading: false });
      }
    }
    init();
    
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

  // Backup em Local Storage apenas como segurança da interface (opcional agora)
  useEffect(() => {
    if (turno) {
      void saveCurrentShiftCache(turno, transacoes, fantasmas, logs);
    }
  }, [turno, transacoes, fantasmas, logs]);

  // Ouvintes do Banco de Dados (Firestore / RTDB)
  useEffect(() => {
    if (!turno?.id) return;
    
    // O banco de dados (Firestore ou RTDB) avisará automaticamente se houver mudanças.
    // O Firestore resolve offline e merges automaticamente antes de disparar isso.
    const unsubTurno = ouvirTurno(turno.id, (data) => {
      useCaixaStore.setState({ turno: data || null });
    });
    
    const unsubTransacoes = ouvirTransacoes(turno.id, (data, isSuspectEmpty) => {
      const state = useCaixaStore.getState();
      const isNewTurno = state.turno && (Date.now() - state.turno.criadoEm < 5 * 60 * 1000);
      if (isSuspectEmpty && !isNewTurno && !state.isTransacoesLoaded) return;
      useCaixaStore.setState({ transacoes: data, isTransacoesLoaded: true });
    });
    
    const unsubFantasmas = ouvirFantasmas(turno.id, (data, isSuspectEmpty) => {
      const state = useCaixaStore.getState();
      const isNewTurno = state.turno && (Date.now() - state.turno.criadoEm < 5 * 60 * 1000);
      if (isSuspectEmpty && !isNewTurno && !state.isFantasmasLoaded) return;
      useCaixaStore.setState({ fantasmas: data, isFantasmasLoaded: true });
    });
    
    const unsubLogs = ouvirLogsAuditoria(turno.id, (data) => {
      useCaixaStore.setState({ logs: data });
    });

    const unsubPOS = ouvirRegistrosPOS(turno.id, (data, isSuspectEmpty) => {
      const state = useCaixaStore.getState();
      const isNewTurno = state.turno && (Date.now() - state.turno.criadoEm < 5 * 60 * 1000);
      if (isSuspectEmpty && !isNewTurno && !state.isRegistrosPOSLoaded) return;
      useCaixaStore.setState({ registrosPOS: data, isRegistrosPOSLoaded: true });
    });
    
    const unsubConvenio = ouvirRegistrosConvenio(turno.id, (data, isSuspectEmpty) => {
      const state = useCaixaStore.getState();
      const isNewTurno = state.turno && (Date.now() - state.turno.criadoEm < 5 * 60 * 1000);
      if (isSuspectEmpty && !isNewTurno && !state.isRegistrosConvenioLoaded) return;
      useCaixaStore.setState({ registrosConvenio: data, isRegistrosConvenioLoaded: true });
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
      useCaixaStore.setState({ historicoTurnos: todos });
    } catch (err) {
      console.warn("Erro ao buscar historico", err);
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
      await atualizarStatusTurno(turno.id, "fechado");
    },
    reabrirTurno: async () => {
      if (!turno) return;
      await atualizarStatusTurno(turno.id, "aberto");
    },
    excluirTurno: async (id: string) => {
      await removerTurnoTotal(id);
      if (turno?.id === id) useCaixaStore.setState({ turno: null });
      await carregarHistoricoTurnos();
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
      await adicionarTransacao(turno.id, input);
    },
    excluirTransacao: async (id: string) => {
      if (!turno) return;
      await removerTransacao(turno.id, id);
    },
    editarLançamento: async (id: string, input: any) => {
      if (!turno) return;
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
      await adicionarFantasma(turno.id, input);
    },
    editarFantasma: async (id: string, input: any) => {
      if (!turno) return;
      await atualizarFantasmaCompleto(turno.id, id, input);
    },
    excluirFantasma: async (id: string) => {
      if (!turno) return;
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
      await adicionarRegistroPOS(turno.id, input);
    },
    editarRegistroPOS: async (id: string, input: any) => {
      if (!turno) return;
      await editarRegistroPOS(turno.id, id, input);
    },
    excluirRegistroPOS: async (id: string) => {
      if (!turno) return;
      await removerRegistroPOS(turno.id, id);
    },
    salvarRelatorioPOSTotal: async (valor: number) => {
      if (!turno) return;
      await salvarRelatorioPOSTotal(turno.id, valor);
    },
    criarConvenio: async (input: any) => {
      if (!turno) return;
      void scheduleInactivityAlert();
      await adicionarConvenio(turno.id, input);
    },
    editarConvenio: async (id: string, input: any) => {
      if (!turno) return;
      await editarConvenio(turno.id, id, input);
    },
    excluirConvenio: async (id: string) => {
      if (!turno) return;
      await removerConvenio(turno.id, id);
    },
  };
}
