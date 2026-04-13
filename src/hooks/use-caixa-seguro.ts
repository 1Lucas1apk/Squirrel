import { useEffect, useMemo, useState, useRef } from "react";
import { hasFirebaseConfig } from "../config/env";
import { calcularTotaisTurno } from "../features/fechamento/calculos";
import {
  adicionarFantasma,
  adicionarTransacao,
  atualizarConferenciaTransacao,
  atualizarFantasmaCompleto,
  buscarTurnoPorId,
  buscarUltimoTurnoAberto,
  criarNovoTurno,
  editarTransacao,
  listarTurnosRecentes,
  ouvirFantasmas,
  ouvirTransacoes,
  ouvirTurno,
  removerFantasma,
  removerTransacao,
  removerTurnoTotal,
  salvarAjusteSobra,
  salvarTotaisTurno,
} from "../services/repositories/caixa-repository";
import { LembreteFantasma, Transacao, Turno } from "../types/domain";
import { getTodayReferenceDate } from "../utils/date";

export function useCaixaSeguro() {
  const [turno, setTurno] = useState<Turno | null>(null);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [fantasmas, setFantasmas] = useState<LembreteFantasma[]>([]);
  const [historicoTurnos, setHistoricoTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sincronização direta e leve
  useEffect(() => {
    if (!turno?.id) return;

    const unsubTurno = ouvirTurno(turno.id, setTurno);
    const unsubTransacoes = ouvirTransacoes(turno.id, setTransacoes);
    const unsubFantasmas = ouvirFantasmas(turno.id, setFantasmas);

    return () => {
      unsubTurno();
      unsubTransacoes();
      unsubFantasmas();
    };
  }, [turno?.id]);

  const totais = useMemo(
    () => calcularTotaisTurno(transacoes, fantasmas, turno?.ajusteManualSobra ?? 0),
    [transacoes, fantasmas, turno?.ajusteManualSobra]
  );

  // Salvamento inteligente sem travar a UI
  useEffect(() => {
    if (!turno?.id) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      const current = turno.totais;
      if (
        totais.sistema !== current.sistema ||
        totais.sobra !== current.sobra ||
        totais.gavetaFisico !== current.gavetaFisico
      ) {
        void salvarTotaisTurno(turno.id, totais);
      }
    }, 3000); 

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [totais]);

  async function iniciarNovoDia() {
    setLoading(true);
    try {
      const created = await criarNovoTurno(getTodayReferenceDate());
      setTurno(created);
    } catch (err) {
      setError("Erro ao iniciar dia.");
    } finally {
      setLoading(false);
    }
  }

  async function continuarDiaAnterior() {
    setLoading(true);
    try {
      const openTurno = await buscarUltimoTurnoAberto();
      if (openTurno) setTurno(openTurno);
      else setError("Nenhum turno aberto.");
    } catch (err) {
      setError("Erro ao carregar turno.");
    } finally {
      setLoading(false);
    }
  }

  async function carregarHistoricoTurnos() {
    setLoading(true);
    try {
      const list = await listarTurnosRecentes();
      setHistoricoTurnos(list);
    } finally {
      setLoading(false);
    }
  }

  async function abrirTurnoPorId(turnoId: string) {
    setLoading(true);
    try {
      const found = await buscarTurnoPorId(turnoId);
      if (found) setTurno(found);
    } finally {
      setLoading(false);
    }
  }

  async function excluirTurno(turnoId: string) {
    try {
      await removerTurnoTotal(turnoId);
      if (turno?.id === turnoId) setTurno(null);
      await carregarHistoricoTurnos();
    } catch (err) {
      setError("Falha ao excluir.");
    }
  }

  return {
    turno,
    transacoes,
    fantasmas,
    historicoTurnos,
    totais,
    loading,
    error,
    iniciarNovoDia,
    continuarDiaAnterior,
    carregarHistoricoTurnos,
    abrirTurnoPorId,
    excluirTurno,
    definirAjusteSobra: (v: number) => turno && salvarAjusteSobra(turno.id, v),
    criarTransacao: (i: any) => turno && adicionarTransacao(turno.id, i),
    excluirTransacao: (id: string) => turno && removerTransacao(turno.id, id),
    editarLançamento: (id: string, i: any) => turno && editarTransacao(turno.id, id, i),
    alternarConferencia: (t: Transacao) => {
      if (!turno) return;
      const status = t.statusConferencia === "pendente" ? "confirmada" : "pendente";
      return atualizarConferenciaTransacao(turno.id, t.id, status);
    },
    criarFantasma: (i: any) => {
      if (!turno) return;
      return adicionarFantasma(turno.id, i);
    },
    excluirFantasma: (id: string) => {
      if (!turno) return;
      return removerFantasma(turno.id, id);
    },
    alternarFantasmaResolvido: (f: LembreteFantasma) => {
      if (!turno) return;
      return atualizarFantasmaCompleto(turno.id, f.id, { resolvido: !f.resolvido });
    },
    alternarFantasmaComprovado: (f: LembreteFantasma) => {
      if (!turno) return;
      return atualizarFantasmaCompleto(turno.id, f.id, { comprovado_pix: !f.comprovadoPix } as any);
    },
  };
}
