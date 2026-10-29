import { LedgerEvent, Transacao, StatusTransacaoLedger } from "../../types/domain";

export interface ResultadoProcessamentoLedger {
  transacoes: Transacao[];
  conflitos: Transacao[];
}

/**
 * Processador de Eventos Puro e Determinístico (CQRS / Event Sourcing)
 * Reconstitui o estado atual de todas as transações a partir da lista imutável de eventos do Ledger.
 */
export function processarLedgerEventos(eventos: LedgerEvent[]): ResultadoProcessamentoLedger {
  if (!eventos || eventos.length === 0) {
    return { transacoes: [], conflitos: [] };
  }

  // 1. Agrupa eventos pelo transacaoId
  const grupos = new Map<string, LedgerEvent[]>();

  for (const ev of eventos) {
    if (!ev || !ev.transacaoId) continue;
    const lista = grupos.get(ev.transacaoId) || [];
    lista.push(ev);
    grupos.set(ev.transacaoId, lista);
  }

  const transacoesProjetadas: Transacao[] = [];
  const conflitosDetectados: Transacao[] = [];

  // 2. Processa cada entidade transação de forma causal
  for (const [transacaoId, eventsForTx] of grupos.entries()) {
    // Ordena por criadoEmDevice e sequence
    const ordenados = [...eventsForTx].sort((a, b) => {
      if (a.sequence !== b.sequence) return a.sequence - b.sequence;
      return (a.criadoEmDevice || 0) - (b.criadoEmDevice || 0);
    });

    let currentTx: Transacao | null = null;
    let versaoAtual = 0;
    const historicoEventosIds: string[] = [];
    const competingEdits: LedgerEvent[] = [];

    for (const ev of ordenados) {
      historicoEventosIds.push(ev.id);

      switch (ev.tipo) {
        case "CRIACAO_TRANSACAO":
        case "SANGRIA":
        case "SUPRIMENTO": {
          versaoAtual = 1;
          currentTx = {
            id: transacaoId,
            turnoId: ev.turnoId,
            timestamp: ev.criadoEmDevice || Date.now(),
            naturezaOperacao: ev.naturezaOperacao || "pagamento",
            categoria: ev.categoria || "dinheiro",
            descricao: ev.descricao || "",
            codigoContrato: ev.codigoContrato,
            valorSistema: ev.valorSistema || 0,
            valorRecebidoFisico: ev.valorRecebidoFisico || 0,
            trocoSobra: ev.trocoSobra || 0,
            statusConferencia: "confirmada",
            statusLedger: "CONFIRMADO",
            versao: versaoAtual,
            deviceId: ev.deviceId,
            operadorId: ev.operadorId,
            operadorNome: ev.operadorNome,
            justificativaTexto: ev.justificativaTexto,
            eventosVinculados: [...historicoEventosIds],
          };
          break;
        }

        case "EDICAO_TRANSACAO": {
          if (!currentTx) {
            // Edição recebida antes da criação (reordenação eventual)
            versaoAtual = (ev.baseVersion || 0) + 1;
            currentTx = {
              id: transacaoId,
              turnoId: ev.turnoId,
              timestamp: ev.criadoEmDevice || Date.now(),
              naturezaOperacao: ev.naturezaOperacao || "pagamento",
              categoria: ev.categoria || "dinheiro",
              descricao: ev.descricao || "",
              valorSistema: ev.valorSistema || 0,
              valorRecebidoFisico: ev.valorRecebidoFisico || 0,
              trocoSobra: ev.trocoSobra || 0,
              statusConferencia: "confirmada",
              statusLedger: "CONFIRMADO",
              versao: versaoAtual,
              deviceId: ev.deviceId,
              operadorId: ev.operadorId,
              operadorNome: ev.operadorNome,
              eventosVinculados: [...historicoEventosIds],
            };
          } else {
            // DETECÇÃO DE CONCORRÊNCIA CAUSAL (baseVersion)
            const isConcorrente = ev.baseVersion !== undefined && ev.baseVersion < versaoAtual;

            if (isConcorrente && ev.deviceId !== currentTx.deviceId) {
              // Conflito Real: outro aparelho editou a partir da mesma versão base
              competingEdits.push(ev);
              currentTx.statusLedger = "CONFLITO";
              currentTx.conflitosConcorrentes = [...competingEdits];
            } else {
              // Atualização linear segura
              versaoAtual += 1;
              currentTx.valorSistema = ev.valorSistema !== undefined ? ev.valorSistema : currentTx.valorSistema;
              currentTx.valorRecebidoFisico = ev.valorRecebidoFisico !== undefined ? ev.valorRecebidoFisico : currentTx.valorRecebidoFisico;
              currentTx.trocoSobra = ev.trocoSobra !== undefined ? ev.trocoSobra : currentTx.trocoSobra;
              if (ev.descricao) currentTx.descricao = ev.descricao;
              if (ev.categoria) currentTx.categoria = ev.categoria;
              currentTx.versao = versaoAtual;
              currentTx.operadorNome = ev.operadorNome;
              currentTx.operadorId = ev.operadorId;
              currentTx.deviceId = ev.deviceId;
              currentTx.eventosVinculados = [...historicoEventosIds];
            }
          }
          break;
        }

        case "CANCELAMENTO_TRANSACAO": {
          if (currentTx) {
            versaoAtual += 1;
            currentTx.statusLedger = "CANCELADO";
            currentTx.versao = versaoAtual;
            currentTx.valorSistema = 0;
            currentTx.valorRecebidoFisico = 0;
            currentTx.trocoSobra = 0;
            currentTx.eventosVinculados = [...historicoEventosIds];
          }
          break;
        }

        case "RESOLUCAO_CONFLITO": {
          if (currentTx) {
            versaoAtual += 1;
            currentTx.statusLedger = "RESOLVIDO";
            currentTx.conflitosConcorrentes = undefined;
            if (ev.valorEscolhidoConflito !== undefined) {
              currentTx.valorSistema = ev.valorEscolhidoConflito;
              currentTx.valorRecebidoFisico = ev.valorEscolhidoConflito;
            }
            currentTx.versao = versaoAtual;
            currentTx.eventosVinculados = [...historicoEventosIds];
          }
          break;
        }
      }
    }

    if (currentTx) {
      transacoesProjetadas.push(currentTx);
      if (currentTx.statusLedger === "CONFLITO") {
        conflitosDetectados.push(currentTx);
      }
    }
  }

  // Ordena cronologicamente para a visualização na tela
  transacoesProjetadas.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  return {
    transacoes: transacoesProjetadas,
    conflitos: conflitosDetectados,
  };
}
