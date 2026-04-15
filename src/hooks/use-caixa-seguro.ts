import { useEffect, useMemo, useState, useRef } from "react";
import { hasFirebaseConfig } from "../config/env";
import { calcularTotaisTurno } from "../features/fechamento/calculos";
import {
  adicionarFantasma,
  adicionarTransacao,
  adicionarDivida,
  alternarDivida,
  removerDivida,
  ouvirDividas,
  atualizarConferenciaTransacao,
  atualizarFantasmaCompleto,
  buscarTurnoPorId,
  buscarUltimoTurnoAberto,
  criarNovoTurno,
  editarTransacao,
  atualizarStatusTurno,
  listarTurnosRecentes,
  ouvirFantasmas,
  ouvirTransacoes,
  ouvirTurno,
  removerFantasma,
  removerTransacao,
  removerTurnoTotal,
  salvarAjusteSobra,
  salvarTotaisTurno,
  salvarContagemCedulas,
  atualizarIdentificacao,
  atualizarStatusRepasse
  } from "../services/repositories/caixa-repository";
import { LembreteFantasma, Transacao, Turno, DividaCliente, ContagemCedulas } from "../types/domain";
import { getTodayReferenceDate } from "../utils/date";

export function useCaixaSeguro() {
  const [turno, setTurno] = useState<Turno | null>(null);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [fantasmas, setFantasmas] = useState<LembreteFantasma[]>([]);
  const [historicoTurnos, setHistoricoTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!turno?.id) return;
    const unsubTurno = ouvirTurno(turno.id, (data) => {
      if (!data) {
        setTurno(null);
        return;
      }
      setTurno(data);
    });
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

  useEffect(() => {
    if (!turno?.id) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const current = turno.totais;
      if (totais.sistema !== current.sistema || totais.sobra !== current.sobra || totais.gavetaFisico !== current.gavetaFisico) {
        void salvarTotaisTurno(turno.id, totais);
      }
    }, 3000); 
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [totais]);

  async function iniciarNovoDia() {
    setLoading(true);
    try { const created = await criarNovoTurno(getTodayReferenceDate()); setTurno(created); } catch (err) { setError("Erro ao iniciar dia."); } finally { setLoading(false); }
  }

  async function continuarDiaAnterior() {
    setLoading(true);
    try { const openTurno = await buscarUltimoTurnoAberto(); if (openTurno) setTurno(openTurno); else setError("Nenhum turno aberto."); } catch (err) { setError("Erro ao carregar turno."); } finally { setLoading(false); }
  }

  async function carregarHistoricoTurnos() {
    setLoading(true);
    try { const list = await listarTurnosRecentes(); setHistoricoTurnos(list); } finally { setLoading(false); }
  }

  async function abrirTurnoPorId(turnoId: string) {
    setLoading(true);
    try { const found = await buscarTurnoPorId(turnoId); if (found) setTurno(found); } finally { setLoading(false); }
  }

  return {
    turno, transacoes, fantasmas, historicoTurnos, totais, loading, error,
    iniciarNovoDia, continuarDiaAnterior, carregarHistoricoTurnos, abrirTurnoPorId,
    fecharTurno: () => turno && atualizarStatusTurno(turno.id, "fechado"),
    reabrirTurno: () => turno && atualizarStatusTurno(turno.id, "aberto"),
    excluirTurno: async (id: string) => {
      await removerTurnoTotal(id);
      if (turno?.id === id) setTurno(null);
      carregarHistoricoTurnos();
    },
    definirAjusteSobra: (v: number) => turno && salvarAjusteSobra(turno.id, v),
    criarTransacao: (i: any) => turno && adicionarTransacao(turno.id, i),
    excluirTransacao: (id: string) => turno && removerTransacao(turno.id, id),
    editarLançamento: (id: string, i: any) => turno && editarTransacao(turno.id, id, i),
    alternarConferencia: (t: Transacao) => turno && atualizarConferenciaTransacao(turno.id, t.id, t.statusConferencia === "pendente" ? "confirmada" : "pendente"),
    reportarErroTransacao: (id: string, valorReal: number, justificativa: string) => {
      if (!turno) return;
      const t = transacoes.find(x => x.id === id);
      if (!t) return;
      return editarTransacao(turno.id, id, { 
        ...t,
        valorRecebidoFisico: valorReal,
        trocoSobra: valorReal - t.valorSistema,
        statusConferencia: "incorreto",
        justificativaTexto: justificativa
      });
    },
    criarFantasma: (i: any) => turno && adicionarFantasma(turno.id, i),
    editarFantasma: (id: string, i: any) => turno && atualizarFantasmaCompleto(turno.id, id, i),
    excluirFantasma: (id: string) => turno && removerFantasma(turno.id, id),
    alternarFantasmaResolvido: (f: LembreteFantasma) => turno && atualizarFantasmaCompleto(turno.id, f.id, { resolvido: !f.resolvido }),
    alternarFantasmaComprovado: (f: LembreteFantasma) => turno && atualizarFantasmaCompleto(turno.id, f.id, { comprovado_pix: !f.comprovadoPix }),
    salvarContagem: (c: ContagemCedulas) => turno && salvarContagemCedulas(turno.id, c),
    salvarIDs: (c: string, o: string) => turno && atualizarIdentificacao(turno.id, c, o),
    alternarRepasse: async (id: string, repassado: boolean) => {
      await atualizarStatusRepasse(id, repassado);
      carregarHistoricoTurnos(); 
    },
  };
}
