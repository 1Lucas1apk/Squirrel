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
  atualizarStatusRepasse,
  ouvirLogsAuditoria,
  salvarNotaDia,
  adicionarTransacao,
  editarTransacao,
  removerTransacao,
  adicionarFantasma,
  atualizarFantasmaCompleto,
  removerFantasma,
  registrarLogAlteracao
} from "../services/repositories/caixa-repository";
import { LembreteFantasma, Transacao, Turno, ContagemCedulas, LogAlteracao } from "../types/domain";
import { getTodayReferenceDate } from "../utils/date";
import { clearCurrentShiftCache, saveCurrentShiftCache } from "../services/local-storage";
import { scheduleInactivityAlert } from "../services/notifications";
import { useCaixaStore } from "../store/caixa-store";

export function useCaixaSeguro() {
  const state = useCaixaStore();
  const { turno, transacoes, fantasmas, logs, historicoTurnos, loading, error } = state;

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
    
    const unsubTransacoes = ouvirTransacoes(turno.id, (data) => {
      useCaixaStore.setState({ transacoes: data });
    });
    
    const unsubFantasmas = ouvirFantasmas(turno.id, (data) => {
      useCaixaStore.setState({ fantasmas: data });
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

  // Calcula Totais e salva na nuvem (Debounce natural já ocorre pelo design de UI)
  useEffect(() => {
    if (turno && turno.statusTurno === "aberto") {
      void salvarTotaisTurno(turno.id, totais);
    }
  }, [turno?.id, totais]);

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
          useCaixaStore.setState({ turno: t, transacoes: [], fantasmas: [], logs: [] });
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
        useCaixaStore.setState({ turno: novo, transacoes: [], fantasmas: [], logs: [] });
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
      useCaixaStore.setState({ turno: null, transacoes: [], fantasmas: [], logs: [] });
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
  };
}
